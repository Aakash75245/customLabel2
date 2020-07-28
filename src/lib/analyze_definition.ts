import { Connection, Org, SfdxError } from '@salesforce/core';
import { IFException,IFJob, IFProcessResult, IFQuery, IFRecordType, IFSAJ_Analyze_Result__c, IFSAJ_Environment__c, IFSAJ_Release__c, IFSAJ_Release_Component__c, IFSAJ_Release_Component_Environment__c, IFSAJ_Release_Environment__c, IFSummary, IFUser, IFLocalFile, IFSAJ_Release_Exception, IFSAJ_JOb_Message } from './analyze_object_definition';
import JobResultTemplate1 from './analyze_result_template1';
import JobResultTemplate2 from './analyze_result_template2';
import { prepareMapOfException,fnBuildSoql, fnResultErrorMsg, fnResultSuccess, getAbsolutePath, getFilesFromDirectory, getObjectFilesForStandardObjects} from './analyze_util';
import JobResultTemplate3 from './analyze_result_template4';
import JobResultTemplate4 from './analyze_result_template4';
import { DoaspasXPathShared } from './analyze_xpath';
import * as path from "path";

enum ResultTemplate {
    releasecomponent,
    buildsingle,
    buildmulti,
    environmentsingle,
    environmentmulti
}
abstract class DoaspasJob {
    public field: IFJob;
    public ref: string;

    constructor( job: IFJob) {
        this.field = job;
        this.ref = job.Name + '-' + Date.now() + '-' + Math.round(Math.random() * 1000000);
    }
}

abstract class DoaspasBuildJob extends DoaspasJob {
    public static runLocal: boolean = false;
    public result: JobResultTemplate1|JobResultTemplate2;

    constructor(job: IFJob) {
        super(job);
     }

     public abstract run(): Promise<JobResultTemplate1|JobResultTemplate2>;

     public getSummary(): IFSummary {
         return this.result.summary;
    }
}

abstract class DoaspasEnvJob extends DoaspasJob {
    public static runLocal: boolean = false;
    public result: JobResultTemplate3|JobResultTemplate4;

    constructor(job: IFJob) {
        super(job);
     }

     public abstract run(): Promise<JobResultTemplate3|JobResultTemplate4>;

     public getSummary(): IFSummary {
         return this.result.summary;
    }
}

class DoaspasShared {
    public static isForDelete:boolean;
    public static mapOfValidComponentsList = new Map<String,String>();
    public static mapOfNotValidComponentList = new Map<String,String>();
    public static Id_Of_Exception:string;
    public static mapOfException = new Map<String,IFException[]>(); 
    public static jobPassed:boolean=true;
    public static buildPassed:boolean=true;
    public static exceptionValues: IFSAJ_Release_Exception[];        
    public static acCon: Connection;
    public static envCon: Connection;
    public static summaryRec: IFSAJ_Analyze_Result__c = {};
    public static runMode: string;
    public static local: boolean;
    public static user: IFUser;
    public static mapRecordType: Map<string, string>;
    public static environment: IFSAJ_Environment__c;
    public static build: IFSAJ_Release__c;
    public static buildcompenv: IFSAJ_Release_Component_Environment__c[]=[];
    public static buildcomp: IFSAJ_Release_Component__c[];
    public static standardObject: string[] = new Array();
    public static dtNowUTCString: string;
    public static dtNow: Date;
    public static doaspasXPath: DoaspasXPathShared;
    public static localFiles: IFLocalFile[] = new Array();
    protected conn: Connection;
    protected target: string;
    protected buildRef: string;
    protected buildEnvId: string;
    public static jobMessage:IFSAJ_JOb_Message={};    

     constructor(conn: Connection, target: string, buildRef: string, buildEnvId: string) {
        this.conn = conn;
        this.target = target;
        this.buildRef = buildRef;
        this.buildEnvId = buildEnvId;
    }

    public async Init(): Promise<string> {
        DoaspasShared.acCon = this.conn;
        const user = await this.conn.query<IFUser>('select id from user where username = ' + '\'' +  this.conn.getUsername() + '\'');
        DoaspasShared.user = user.records[0];
        const dtnow: Date = new Date(Date.now());
        DoaspasShared.dtNow = dtnow;
        DoaspasShared.dtNowUTCString = dtnow.getUTCFullYear() + '-' + (dtnow.getUTCMonth() + 1).toString().padStart(2, '0') + '-' + dtnow.getUTCDate().toString().padStart(2, '0');

        return 'OK';
    }

    public async InitBuild(): Promise<string> {

        // ### Retrieve the list of standard objects for the org
        const describe = await this.conn.describeGlobal();
        for (const f of describe['sobjects']) {
            if (!f['custom'] && !f['name'].includes('__')) {
                DoaspasShared.standardObject.push(f['name']);
            }
        }
        DoaspasShared.doaspasXPath = new DoaspasXPathShared();
        await DoaspasShared.doaspasXPath.Init();

        return await this.SetRunMode();
    }

    public async InitEnv(env: IFSAJ_Environment__c): Promise<string> {
        DoaspasShared.environment = env;
        return 'Environment Analyze';
    }

    public async SetRunMode(): Promise<string> {
        let r: string;

        if (this.buildEnvId === null || this.buildEnvId === undefined) {

            if (this.target === null || this.target === undefined) {
                DoaspasShared.runMode = 'local';
                DoaspasShared.local = true;
                r = 'No target or deployid provided';
            }

        } else {
            DoaspasShared.runMode = 'release';
            DoaspasShared.local = false;

            const q: IFQuery = {conn: this.conn,
                                field: ['Id', 'SAJ_Release__r.Name', 'SAJ_Environment__r.SAJ_Username__c','SAJ_Environment__r.SAJ_Type__c'],
                                object: 'SAJ_Release_Environment__c',
                                where: 'Id = ' + '\'' + this.buildEnvId + '\' limit 1'};
            const qr = await this.conn.query<IFSAJ_Release_Environment__c>(await fnBuildSoql(q));

            if (qr.totalSize === 0) {
                throw new SfdxError('No Build Environment Found for Deployment Id: ' + this.buildEnvId);
            } else {
                DoaspasShared.buildcompenv = qr.records;
                this.buildRef = qr.records[0].SAJ_Release__r.Name;
                this.target = qr.records[0].SAJ_Environment__r.SAJ_Username__c;
                r = 'Release Build: ' + qr.records[0].Id + ' (' + this.buildRef + ')';
            }
        }

        if (!DoaspasShared.local || DoaspasShared.local === null || DoaspasShared.local === undefined) {

                const env = await Org.create({
                    aliasOrUsername: this.target
                });
                DoaspasShared.envCon = env.getConnection();

                if (DoaspasShared.local === null || DoaspasShared.local === undefined) {
                    DoaspasShared.runMode = 'connected';
                    DoaspasShared.local = false;
                }
                r = 'Connnected to Target:' + DoaspasShared.envCon.getUsername();
        }
        return r;
    }

    public async LoadRecordType(): Promise<void> {
        const q = 'SELECT Id, DeveloperName FROM RecordType where Sobjecttype in (\'SAJ_Analyze_Result__c\',\'SAJ_Environment__c\',\'SAJ_Analyze_Job__c\')   ';
        const r = await this.conn.query<IFRecordType>(q);
        const res = new Map();
        for (const f of r.records) {
            res.set(f.DeveloperName, f.Id);
        }
        DoaspasShared.mapRecordType = res;
    }

    public async InitEnvironmentSummary(env: IFSAJ_Environment__c): Promise<string> {
        let r: string = '';
        DoaspasShared.summaryRec.RecordTypeId =  DoaspasShared.mapRecordType.get('Environment_Summary');
        DoaspasShared.summaryRec.Name = 'Environment Summary';
        DoaspasShared.summaryRec.SAJ_Environment__c = env.Id;

        const p = await this.conn.insert('SAJ_Analyze_Result__c', DoaspasShared.summaryRec);
        if (!fnResultSuccess(p)) {
            for (const f of fnResultErrorMsg(p)) {
              r += f + '\n';
            }
            throw new SfdxError('Can not create environment summary record \n' + r);
        } else {
            DoaspasShared.summaryRec.Id = p['id'];
            r = p['id'];
        }
        return r;
    }

    public async InitBuildSummary(): Promise<string> {
        let r: string = '';
        DoaspasShared.summaryRec.RecordTypeId =  DoaspasShared.mapRecordType.get('Build_Summary');
        DoaspasShared.summaryRec.Name = 'Build Summary';
        DoaspasShared.summaryRec.SAJ_Passed__c = false;
        DoaspasShared.summaryRec.SAJ_App__c = DoaspasShared.build.SAJ_Application__r.Id;
        DoaspasShared.summaryRec.SAJ_Release__c = DoaspasShared.build.Id;

        const p = await this.conn.insert('SAJ_Analyze_Result__c', DoaspasShared.summaryRec);
        if (!fnResultSuccess(p)) {
            for (const f of fnResultErrorMsg(p)) {
              r += f + '\n';
            }
            throw new SfdxError('Can not create build summary record \n' + r);
        } else {
            DoaspasShared.summaryRec.Id = p['id'];
            r = p['id'];
        }
        return r;
    }
    

    public async CompleteBuildSummary(): Promise<void> {

        const p = await this.conn.update('SAJ_Analyze_Result__c', DoaspasShared.summaryRec);
        if (!fnResultSuccess(p)) {
            for (const f of fnResultErrorMsg(p)) {
              console.log('lets See ');
                console.log(f);
            }
            throw new SfdxError('Can not update build summary record');
        }
    }

    public async LoadBuild(): Promise<string> {
        if (this.buildRef === null || this.buildRef === undefined) {
            throw new SfdxError('Build undefined - for RunMode:Release check deployment id');
        }

        let q = 'SELECT Id, SAJ_Application__c, SAJ_Application__r.Name, SAJ_Application__r.SAJ_Project_Dev_Prefix__c,SAJ_Application__r.SAJ_Project_Allowed_Prefix__c,SAJ_Application__r.Id, Name FROM SAJ_Release__c where ';
        q += 'Name = ' + '\'' + this.buildRef + '\' limit 1';
        const qr = await this.conn.query<IFSAJ_Release__c>(q);
        if (qr.totalSize === 0) {
            throw new SfdxError('No Build Found for: ' + this.buildRef);
        }
        DoaspasShared.build = qr.records[0];
        return DoaspasShared.build.Id;
    }
    public async LoadBuildEnvironment() {                                        
        let q = 'SELECT Name,ID,SAJ_Environment__r.SAJ_Type__c FROM SAJ_Release_Environment__c WHERE SAJ_Release__r.Name ='+'\''+this.buildRef+'\''+' And SAJ_Status__c='+'\''+'In Progress'+'\''; 
        
        const qr = await this.conn.query<IFSAJ_Release_Environment__c>(q);        
        //console.log(qr.records);
        DoaspasShared.buildcompenv = qr.records; 
        return DoaspasShared.buildcompenv[0].SAJ_Environment__r.SAJ_Type__c;       
    }

    public async LoadBuildComponent(): Promise<string> {
        if (DoaspasShared.build === null || DoaspasShared.build === undefined) {
            throw new SfdxError('Must execute LoadBuild first');
        }
        const q: IFQuery = {conn: this.conn, object: 'SAJ_Release_Component__c', where: 'SAJ_Release__c' + '='  + '\'' + DoaspasShared.build.Id + '\''};
        const qr = await this.conn.autoFetchQuery<IFSAJ_Release_Component__c>(await fnBuildSoql(q));
        DoaspasShared.buildcomp = qr.records;
        return qr.totalSize + ' Record(s)' + 'And ' + qr.records.length;
    }

    public async LoadLocalFiles(directories: string[]): Promise<number> {
        const projectPath = await getAbsolutePath();
        for (const dir of directories) {
            const dirPath = path.normalize(`${projectPath}/force-app/main/default/${dir}`);
            let allFiles: string[];
            if(dir === 'objects') {
                allFiles = await getObjectFilesForStandardObjects(dirPath);
            } else {
                allFiles = await getFilesFromDirectory(dirPath);
            }
            for (let fileName of allFiles) {
                const filePath = path.normalize(`${dirPath}/${fileName}`);
                const localFile: IFLocalFile = {
                    compName: dir + "/" + fileName,
                    fullPath: filePath,
                    isDataLoaded: false,
                    fileData: undefined,
                    directory: dir,
                    fileType: '',
                    isFileSupported: dir != 'aura' ? true:false//Should exclude all the non-xml files.
                };
                DoaspasShared.localFiles.push(localFile);
            }
        }
        return DoaspasShared.localFiles.length;
    }

    public async LoadExceptions(appId,buildName){
        //Fetch Exceptions     

        let exceptionValues = [];      
        let query = 'select Id,SAJ_Exception_Value__c from SAJ_Analyze_Job_Assignment__c where ';
        query += 'SAJ_App__c = ' + '\'' + appId + '\'' + ' and SAJ_Active__c = true and recordtype.developername = \'SAJ_Application_Job_Exceptions\' ' +' and SAJ_Release__r.Name = ' + '\'' + buildName+ '\'' ;
        const exceptionResult = await this.conn.query<IFSAJ_Release_Exception>(query);
        console.log(`Total Exception Records : ${exceptionResult.totalSize}`);
        if(exceptionResult.totalSize>0){
        exceptionValues = exceptionResult.records;
        DoaspasShared.mapOfException = prepareMapOfException(exceptionValues);
        }
        return `For Application Id ${appId} and Build Name ${buildName}`
    }
}

abstract class DoaspasResult {
    public summary: IFSummary;
    public recordtypeid: string;

    constructor() {
        this.summary = {completed: false, passed: false, message: '', startTime: Date.now()};
    }
}

export abstract class DoaspasBuildResult extends DoaspasResult {
    protected job: DoaspasBuildJob;

    constructor(job: DoaspasBuildJob) {
        super();
        this.job = job;
        this.summary.job = job.field;
    }
    public abstract async Insert(): Promise<IFProcessResult>;
    public abstract async Replace(): Promise<IFProcessResult>;
    public abstract async Upsert(): Promise<IFProcessResult>;

    public async Process(): Promise<IFSummary> {

        const rec: IFSAJ_Analyze_Result__c = await this.CreateJobSummary();
        let pResult: IFProcessResult;
        this.setCommonFields();

        switch (this.job.field.Operation) {
            case 'Insert':
                pResult = await this.Insert();
                break;
            case 'Replace':
                pResult = await this.Replace();
                break;
            case 'Upsert':
                pResult = await this.Upsert();
                break;
            default:
                throw new SfdxError('Unknown Job Operation');
                break;
        }

        await this.CompleteJobSummary(rec, pResult);

        return this.summary;
    }

    public async CreateJobSummary(): Promise<IFSAJ_Analyze_Result__c> {
        const jobSummaryRec: IFSAJ_Analyze_Result__c = {};

        jobSummaryRec.RecordTypeId = DoaspasShared.mapRecordType.get('Job_Summary');
        jobSummaryRec.Name = 'Job Summary - ' + this.job.ref;
        jobSummaryRec.SAJ_Passed__c = DoaspasShared.jobPassed;
        jobSummaryRec.SAJ_Analyze_Job__c = this.job.field.JobId;
        jobSummaryRec.SAJ_Analyze_Job_Assignment__c = this.job.field.AssignJobId;

        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', jobSummaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Creating Job Summary');
        } else {
            jobSummaryRec.Id = p['id'];
            console.log('JOb Summary Created '  + p['id']);
        }
        return jobSummaryRec;
    }

    public async CompleteJobSummary(jobSummaryRec: IFSAJ_Analyze_Result__c, pResult: IFProcessResult): Promise<void> {

        this.summary.message += pResult.message;
        this.summary.completed = this.summary.message.localeCompare('') === 0;
        //this.summary.passed = (pResult.passed ==  null ? false : pResult.passed) && this.summary.completed;
        this.summary.passed = DoaspasShared.jobPassed;
        this.summary.endTime = Date.now();
        this.summary.execTime = this.summary.endTime - this.summary.startTime + 1;

        jobSummaryRec.SAJ_Message__c = this.summary.message;
        jobSummaryRec.SAJ_Short_Message__c = this.summary.message.substring(0, 255);
        jobSummaryRec.SAJ_Exec_Time__c = this.summary.execTime;

        const p = await DoaspasShared.acCon.update('SAJ_Analyze_Result__c', jobSummaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Updating Job Summary');
        }
    }

    protected abstract setCommonFields(): void;

    protected setFields(v: IFSAJ_Analyze_Result__c): void {
        v.SAJ_Analyze_Job__c = this.job.field.JobId;
        v.SAJ_Analyze_Job_Assignment__c = this.job.field.AssignJobId;
        v.SAJ_Release__c = DoaspasShared.build.Id;
        v.SAJ_App__c = DoaspasShared.build.SAJ_Application__r.Id;
        v.SAJ_Parent__c = DoaspasShared.summaryRec.Id;
        v.RecordTypeId = this.recordtypeid;
    }
}

export abstract class DoaspasEnvironmentResult extends DoaspasResult {
    protected job: DoaspasEnvJob;

    constructor(job: DoaspasEnvJob) {
        super();
        this.job = job;
        this.summary.job = job.field;
    }
    public abstract async Insert(): Promise<IFProcessResult>;
    public abstract async Replace(): Promise<IFProcessResult>;
    public abstract async Upsert(): Promise<IFProcessResult>;

    public async Process(): Promise<IFSummary> {

        const rec: IFSAJ_Analyze_Result__c = await this.CreateJobSummary();
        let pResult: IFProcessResult;
        this.setCommonFields();

        switch (this.job.field.Operation) {
            case 'Insert':
                pResult = await this.Insert();
                break;
            case 'Replace':
                pResult = await this.Replace();
                break;
            case 'Upsert':
                pResult = await this.Upsert();
                break;
            default:
                throw new SfdxError('Unknown Job Operation');
                break;
        }

        await this.CompleteJobSummary(rec, pResult);

        return this.summary;
    }

    public async CreateJobSummary(): Promise<IFSAJ_Analyze_Result__c> {
        const jobSummaryRec: IFSAJ_Analyze_Result__c = {};

        jobSummaryRec.RecordTypeId = DoaspasShared.mapRecordType.get('Job_Summary');
        jobSummaryRec.Name = 'Job Summary - ' + this.job.ref;
        jobSummaryRec.SAJ_Analyze_Job__c = this.job.field.JobId;
        jobSummaryRec.SAJ_Analyze_Job_Assignment__c = this.job.field.AssignJobId;
        jobSummaryRec.SAJ_Environment__c = DoaspasShared.environment.Id;

        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', jobSummaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Creating Job Summary');
        } else {
            jobSummaryRec.Id = p['id'];
        }
        return jobSummaryRec;
    }

    public async CompleteJobSummary(jobSummaryRec: IFSAJ_Analyze_Result__c, pResult: IFProcessResult): Promise<void> {
        this.summary.message += pResult.message;
        this.summary.completed = this.summary.message.localeCompare('') === 0;
        this.summary.endTime = Date.now();
        this.summary.execTime = this.summary.endTime - this.summary.startTime + 1;

        jobSummaryRec.SAJ_Message__c = this.summary.message;
        jobSummaryRec.SAJ_Short_Message__c = this.summary.message.substring(0, 255);
        jobSummaryRec.SAJ_Exec_Time__c = this.summary.execTime;

        console.log(jobSummaryRec);

        const p = await DoaspasShared.acCon.update('SAJ_Analyze_Result__c', jobSummaryRec);
        if (!fnResultSuccess(p)) {
            throw new SfdxError('Error Updating Job Summary');
        }
    }

    protected abstract setCommonFields(): void;

    protected setFields(v: IFSAJ_Analyze_Result__c): void {
        v.SAJ_Analyze_Job__c = this.job.field.JobId;
        v.SAJ_Analyze_Job_Assignment__c = this.job.field.AssignJobId;
        v.SAJ_Environment__c = DoaspasShared.environment.Id;
        v.SAJ_Parent__c = DoaspasShared.summaryRec.Id;
        v.RecordTypeId = this.recordtypeid;
    }
}

export {DoaspasBuildJob, DoaspasEnvJob, ResultTemplate, DoaspasShared };
