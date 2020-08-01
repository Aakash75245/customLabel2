import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { DoaspasShared } from '../../lib/analyze_definition';
import { jobmap } from '../../lib/analyze_job_mapping';
import { IFJob, IFSAJ_Analyze_Job__c, IFSAJ_Analyze_Job_Assignment__c, IFSummary } from '../../lib/analyze_object_definition';
import { isNullOrUndefined } from 'util';

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
 

    const r = new Array();

    // ### check if we are connected to App Central
    const conn = this.org.getConnection();
     

    // ### Load defaults
    const shared = new DoaspasShared(conn, this.flags.targetorg, this.flags.name, this.flags.buildenvid);
    await shared.LoadRecordType();
    this.ux.log ('INIT: ' + await shared.Init());
    this.ux.log ('INIT BUILD: ' + await shared.InitBuild());
    this.ux.log ('BUILD: ' + await shared.LoadBuild());
    this.ux.log ('BUILD ENVIRONMENT: ' + await shared.LoadBuildEnvironment());
    this.ux.log ('BUILD COMPONENTS: ' + await shared.LoadBuildComponent());
    this.ux.log ('BUILD SUMMARY: ' + await shared.InitBuildSummary());

    const appId = DoaspasShared.build.SAJ_Application__c;
    this.ux.log ('FETCH EXCEPTIONS: ' + await shared.LoadExceptions(appId,this.flags.name));
    this.ux.log ('LOAD LOCAL FILES: '+await shared.LoadLocalFiles(['permissionsets', 'objects','labels']));

    this.ux.log ('DOASPAS RunMode: ' + DoaspasShared.runMode);
    
    let q: string;

    const jobArray: IFJob[] = new Array<IFJob>();

    // console.log ('### Read the job assignments for the corresponding App');
    q = 'select Id, SAJ_Parameter_1__c, SAJ_Operation__c, SAJ_App__c, SAJ_Analyze_Job__r.Id, SAJ_Analyze_Job__r.Name, Name, SAJ_Enabled__c from SAJ_Analyze_Job_Assignment__c where ';
    q += 'SAJ_App__c = ' + '\'' + appId + '\''+ ' and recordtype.developername = \'SAJ_Application_Job\'';
    const jobAssign = await conn.query<IFSAJ_Analyze_Job_Assignment__c>(q);
    
    const jobAssignMap: Map<string, IFSAJ_Analyze_Job_Assignment__c> = new Map();
    for (const f of jobAssign.records) {
      if ( !isNullOrUndefined(f.SAJ_Analyze_Job__r)) {
        jobAssignMap.set(f.SAJ_Analyze_Job__r.Id, f);
      }
    }
    //console.log(`Job Assignment Map ${JSON.stringify(jobAssignMap)}`);
    // console.log ('### Read all active build jobs');
    q = 'select id, Name, SAJ_Parameter_1__c, SAJ_Default_Assign__c, SAJ_Operation__c, SAJ_Job_Group__c from SAJ_Analyze_Job__c where SAJ_Enabled__c = true and ';
    q += '(SAJ_Enabled_Start_Date__c = null or SAJ_Enabled_Start_Date__c <= ' + DoaspasShared.dtNowUTCString + ') and ';
    q += '(SAJ_Enabled_End_Date__c = null or SAJ_Enabled_End_Date__c >= ' + DoaspasShared.dtNowUTCString + ') and ';
    q += 'RecordTypeId = ' + '\'' + DoaspasShared.mapRecordType.get('Release_Job') + '\'';
    const jobs = await conn.query<IFSAJ_Analyze_Job__c>(q);

    // ### Create the mapping here for the Job Definition
    const jobfield: Map<string, string> = new Map < string, string >([['Operation', 'SAJ_Operation__c'],
                                                                      ['Parameter1', 'SAJ_Parameter_1__c']]);

    // ### Add jobs to the jobarray if requirements are met
    for (const f of jobs.records) {
      const i: IFJob = {Name: f.Name, Group:f.SAJ_Job_Group__c,
                        JobId: f.Id};

      // ### Copy the fields
      for (const ffield of jobfield.keys()) {
        i[ffield] = f[jobfield.get(ffield)];
      }

      const assignjob = jobAssignMap.get(f.Id);
      if (assignjob == null || assignjob === undefined) {

        // ### There is no assignment record for this job
        if (f.SAJ_Default_Assign__c) {
         i.AssignJobId = null;
         jobArray.push(i);

        }
      } else {
        // ### There is an assignment record for this job
        if (assignjob.SAJ_Enabled__c) {
          i.AssignJobId = assignjob.Id;
          i.AssignmentJobName = assignjob.Name;

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
    for (const f of jobArray) {
      this.ux.log ('Job:' + f.Name + ' Operation:' + f.Operation + 'Group: '+ f.Group);
    }

   // ### Execute the jobs
    const oJobs = new Array();
    const pJobs = new Array();

    for (const freljob of jobArray) {
      const job = jobmap[freljob.Group];
      if (!DoaspasShared.local || job.runLocal) {

        const ojob = new job(conn, freljob);
        oJobs.push(ojob);
        pJobs.push(ojob.run());

      } else {
        this.ux.log('Skipping Job: ' + freljob.Name + ' (requires a target org)');
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

    for (const f of oJobs) {
      const summary: IFSummary = f.getSummary();

      //rpassed = rpassed && summary.passed;
      rpassed = DoaspasShared.buildPassed;
      rsummary.push({summary});

      if (!summary.passed) {
        message += 'Messages: ' + f.field.Name + ':' + summary.message + '\n';
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

/*

  this.summary.RecordTypeId = DoaspasShared.resultRecordTypeId['Execution_Summary'];
        this.summary.SAJ_Release__c = DoaspasShared.build.Id;

const h = jobmap['JobDummy'];
    const j = new h(conn, 'JobDummy', defaults);
    const r = await j.run();
    console.log(r);
 /*

    const p = await conn.insert('SAJ_Analyze_Result__c', t);
    console.log('hello' + p[0]);
    console.log(p);

    if (!fnResultSuccess(p)) {
      this.ux.log ('Error insert new DeployRequest Id');
      for (const f of fnResultErrorMsg(p)) {
        this.ux.log('index: ' + f.idx + ' - ' + f.message);
      }
    }
*/
    return null;

  }
}
