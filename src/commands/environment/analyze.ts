import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { DoaspasShared } from '../../lib/analyze_definition';
import { jobmap } from '../../lib/analyze_job_mapping';
import { IFJob, IFSAJ_Analyze_Job__c, IFSAJ_Analyze_Job_Assignment__c, IFSAJ_Environment__c, IFSummary, IFSAJ_Analyze_Result__c, IFLastRunDate } from '../../lib/analyze_object_definition';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('doaspas', 'org');

export default class Analyze extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ sfdx build:analyze -u AppCentralOrg -n -t ValidationOrg "Build A" '
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    targetorg: flags.string({char: 't', description: messages.getMessage('nameFlagDescription')}),
    buildenvid: flags.string({char: 'b', description: messages.getMessage('nameFlagDescription')}),
    name: flags.string({char: 'n', description: messages.getMessage('nameFlagDescription')}),
    force: flags.boolean({char: 'f', description: messages.getMessage('forceFlagDescription')})
  };

  // Comment this out if your command does not require an org username
  protected static requiresUsername = true;

  // Comment this out if your command does not support a hub org username
  protected static supportsDevhubUsername = false;

  // Set this to true if your command requires a project workspace; 'requiresProject' is false by default
  protected static requiresProject = false;

  public async run(): Promise<AnyJson> {

    // ### instantiate Cronparser
    const cronparser = require('cron-parser');

    const r = new Array();

    // ### check if we are connected to App Central
    const conn = this.org.getConnection();

    // ### Load defaults
    const shared = new DoaspasShared(conn, this.flags.targetorg, this.flags.name, this.flags.buildenvid);
    await shared.LoadRecordType();

    this.ux.log ('INIT: ' + await shared.Init());

    // ### Read the managed environments
    let q = 'select Id, Name, SAJ_Username__c from SAJ_Environment__c where ';
    q += 'RecordTypeId = ' + '\'' + DoaspasShared.mapRecordType.get('SAJ_Managed_Org') + '\'';
    const environment = await conn.query<IFSAJ_Environment__c>(q);

    for (const f of environment.records) {
      console.log('Environment: ' + f.Name);
      this.ux.log ('ENVIRONMENT INIT: ' + await shared.InitEnv(f));
      this.ux.log ('ENVIRONMENT SUMMARY: ' + await shared.InitEnvironmentSummary(f));

      // ### WIP Find the last run date of the job and compare to the CRON definition
      q = 'select saj_analyze_job__c, max(CreatedDate) LastRunDate from SAJ_Analyze_Result__c';
      q += ' where recordtypeid = \'' + DoaspasShared.mapRecordType.get('Job_Summary') + '\'';
      q += ' and saj_analyze_job__r.recordtypeid = \'' + DoaspasShared.mapRecordType.get('Environment_Job') + '\'';
      q += ' and SAJ_Environment__c = \'' + f.Id + '\'';
      q += ' group by saj_analyze_job__c, saj_environment__c, recordtypeid';
      console.log (q);
      const jobLastRun = await conn.query<IFLastRunDate>(q);
      console.log (jobLastRun);

      const jobLastRunMap: Map<string , IFLastRunDate> = new Map();
      for (const fjobLastRun of jobLastRun.records) {
        jobLastRunMap.set(fjobLastRun.SAJ_Analyze_Job__c, fjobLastRun);
      }

      const jobArray: IFJob[] = new Array<IFJob>();

      // ### Read the job assignments for the corresponding Environment
      q = 'select Id, SAJ_Cron__c, SAJ_Operation__c, SAJ_App__c, SAJ_Analyze_Job__r.Id, SAJ_Analyze_Job__r.Name, name, SAJ_Enabled__c from SAJ_Analyze_Job_Assignment__c where ';
      q += 'SAJ_Environment__c = ' + '\'' + f.Id + '\'';
      const jobAssign = await conn.query<IFSAJ_Analyze_Job_Assignment__c>(q);
      const jobAssignMap: Map<string, IFSAJ_Analyze_Job_Assignment__c> = new Map();
      for (const fjobassign of jobAssign.records) {
        if (fjobassign.SAJ_Analyze_Job__r != null) {
          jobAssignMap.set(fjobassign.SAJ_Analyze_Job__r.Id, fjobassign);
        }
      }

      // ### Read all active environment jobs
      q = 'select Id, SAJ_Cron__c, Name, SAJ_Default_Assign__c, SAJ_Operation__c from SAJ_Analyze_Job__c where SAJ_Enabled__c = true and ';
      q += '(SAJ_Enabled_Start_Date__c = null or SAJ_Enabled_Start_Date__c <= ' + DoaspasShared.dtNowUTCString + ') and ';
      q += '(SAJ_Enabled_End_Date__c = null or SAJ_Enabled_End_Date__c >= ' + DoaspasShared.dtNowUTCString + ') and ';
      q += 'RecordTypeId = ' + '\'' + DoaspasShared.mapRecordType.get('Environment_Job') + '\'';
      const jobs = await conn.query<IFSAJ_Analyze_Job__c>(q);

    // ### Create the mapping here for the Job Definition
      const jobfield: Map<string, string> = new Map < string, string >([['Operation', 'SAJ_Operation__c'],
                                                                      ['Parameter1', 'SAJ_Parameter_1__c'],
                                                                      ['Cron', 'SAJ_Cron__c']
                                                                      ]);

    // ### Add jobs to the jobarray if requirements are met
      for (const f2 of jobs.records) {
        console.log (f2);
        const i: IFJob = {Name: f2.Name,
                        JobId: f2.Id};

      // ### Copy the fields
        for (const ffield of jobfield.keys()) {
        i[ffield] = f2[jobfield.get(ffield)];
      }

        const assignjob = jobAssignMap.get(f2.Id);
        if (assignjob == null || assignjob === undefined) {

        // ### There is no assignment record for this job
        if (f2.SAJ_Default_Assign__c) {
         i.AssignJobId = null;
         jobArray.push(i);

        }
      } else {
        // ### There is an assignment record for this job
        if (assignjob.SAJ_Enabled__c) {
          i.AssignJobId = assignjob.Id;

          // ### Override the fields (in case they are not null)
          for (const ffield of jobfield.keys()) {
            if (assignjob[jobfield.get(ffield)] != null) {
              i[ffield] = assignjob[jobfield.get(ffield)];
            }
          }

          jobArray.push(i);
        }

      }

    }

      this.ux.log ('Jobs that will be executed:');
      for (const ft of jobArray) {
        this.ux.log ('Job:' + ft.Name + ' Operation:' + ft.Operation);
      }

      // ### This is work in progress
      // ### Execute the jobs
      const oJobs = new Array();
      const pJobs = new Array();
      for (const fenvjob of jobArray) {
        const job = jobmap[fenvjob.Name];
        // ### Check the job schedule

        const jobLastRunDate = jobLastRunMap.get(fenvjob.JobId);
        const dtLastRun = new Date(jobLastRunDate.LastRunDate);

        const cronoptions = {
          currentDate: dtLastRun
        };

        try {
          // const cron = cronparser.parseExpression(fenvjob.Cron, cronoptions);
          const cron = cronparser.parseExpression('*/2 * * * *', cronoptions);
          const dtNext: Date = cron.next();

          if (DoaspasShared.dtNow.getTime() > dtNext.getTime()) {
            this.ux.log('Executing Job: ' + fenvjob.Name + ' last scheduled:' + dtLastRun.toString());

            const ojob = new job(conn, fenvjob);
            oJobs.push(ojob);
            pJobs.push(ojob.run());

          } else {
            this.ux.log('Skipping Job: ' + fenvjob.Name + ' next scheduled:' + dtNext.toString());
          }
        } catch (e) {
          this.ux.log('Skipping Job: ' + fenvjob.Name + ' invalid cron: ' + fenvjob.Cron);
        }

      }
      await Promise.all(pJobs);

      this.ux.log ('All jobs completed');

      let message: string = '';
      let totalTime: number = 0;
      let jobMinTime = oJobs[0];
      let jobMaxTime = oJobs[0];
      let rpassed = true;
      const rsummary = new Array();

      for (const f2 of oJobs) {
        const summary: IFSummary = f2.getSummary();

        rpassed = rpassed && summary.passed;
        rsummary.push({summary});

        if (!summary.passed) {
          message += 'Messages: ' + f2.field.Name + ':' + summary.message + '\n';
        }
        totalTime += summary.execTime;
        jobMinTime = summary.execTime < jobMinTime.getSummary().execTime ? f : jobMinTime;
        jobMaxTime = summary.execTime > jobMaxTime.getSummary().execTime ? f : jobMaxTime;
      }

      let jobMinMaxTime: string;
      if (oJobs.length > 0) {
        jobMinMaxTime = 'Fastest Job:' + jobMinTime.field.Name + ' (' + jobMinTime.getSummary().execTime + ')\n';
        jobMinMaxTime += 'Slowest Job:' + jobMaxTime.field.Name + ' (' + jobMaxTime.getSummary().execTime + ')\n';

        DoaspasShared.summaryRec.SAJ_Passed__c = rpassed;
        DoaspasShared.summaryRec.SAJ_Message__c = jobMinMaxTime + message;
        DoaspasShared.summaryRec.SAJ_Total_Time__c = totalTime;
        DoaspasShared.summaryRec.SAJ_Exec_Time__c = jobMaxTime.getSummary().execTime;
      }
      
      await shared.CompleteBuildSummary();

      r.push({BuildSummary: DoaspasShared.summaryRec, details : rsummary});
      return r;

  }
  }
}
