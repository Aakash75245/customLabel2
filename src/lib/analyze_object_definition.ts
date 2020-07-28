import { Connection } from '@salesforce/core';
//import { string } from '@oclif/command/lib/flags';

// #########################################################################
// ### Interfaces for passing data between functions
// #########################################################################

export enum SEVERITY {
    INFO = 1,
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}

export interface IFSummary {
    passed: boolean;
    completed: boolean;
    message: string;
    startTime: number;
    endTime?: number;
    execTime?: number;
    job?: IFJob;
}

export interface IFJob {
    AssignJobId?: string;
    AssignmentJobName?:string;
    JobId?: string;
    Name?: string;
    Cron?: string;
    Operation?: string;
    Parameter1?: string;
    Group?: string;
}

export interface IFProcessResult {
    passed?: boolean;
    message?: string;
}

export interface IFRecordType {
    Id: string;
    DeveloperName: string;
}

export interface IFerror {
    idx: number;
    statusCode: string;
    message: string;
    fields: [];
}

export interface IFQuery {
    conn: Connection;
    object: string;
    field?: string[];
    where?: string;
    limit?: number;
    ids?: Set<string>;
  }

// #########################################################################
// ### Interfaces for Salesforce API
// #########################################################################

// ### Salesforce Custom Oject standard fields
export interface IFSObject {
    attributes?: IFattributes;
    Id?: string;
    Name?: string;
    CreatedDate?: number;
    CreatedById?: string;
    LastModifiedDate?: number;
    LastModifiedById?: string;
    RecordTypeId?: string;
}

// ### API query response standard fields
interface IFattributes {
    type: string;
    url: string;
}

export interface IFLastRunDate {
    SAJ_Analyze_Job__c: string;
    LastRunDate: number;
  }

// tslint:disable-next-line: class-name
export interface IFSAJ_App__c extends IFSObject {
    SAJ_Project_Dev_Prefix__c: string;
    SAJ_Project_Allowed_Prefix__c: string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Release__c extends IFSObject {

    SAJ_Application__c: string;
    SAJ_Application__r: IFSAJ_App__c;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Release_Component__c extends IFSObject {
    SAJ_Component_Type__c: string;
    SAJ_Component_Full_Name__c:string;
    SAJ_Component_Details__c: string;
    SAJ_API_Version__c: string;
    SAJ_Deployment_Sequence__c: string;
    SAJ_Reference__c: string;
    SAJ_Release__c: string;
    SAJ_Status__c: string;
    SAJ_Type__c: string;
}

export interface IFSAJ_Release_Exception extends IFSObject {
    SAJ_Exception_Value__c: string;  
    SAJ_Analyze_Job__r:IFSAJ_Analyze_Job__c;  
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Environment__c extends IFSObject {
    SAJ_Username__c?: string;
    SAJ_Type__c?:string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Release_Environment__c extends IFSObject {
    SAJ_Release__r?: IFSAJ_Release__c;
    SAJ_Environment__r?: IFSAJ_Environment__c;

}

// tslint:disable-next-line: class-name
export interface IFSAJ_Release_Component_Environment__c extends IFSObject {
    SAJ_Release__r?: IFSAJ_Release__c;
    SAJ_Environment__r?: IFSAJ_Environment__c;
    SAJ_Deployment_Id__c?: string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Analyze_Job__c extends IFSObject {
    SAJ_Enabled__c?: boolean;
    SAJ_Operation__c?: string;
    SAJ_Default_Assign__c?: boolean;
    SAJ_Cron__c?: string;
    SAJ_Enabled_End_Date__c?: number;
    SAJ_Enabled_Start_Date__c?: number;
    SAJ_Parameter_1__c?: string;
    SAJ_Parameter1__c?: string;
    SAJ_Job_Group__c?: string;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Analyze_Job_Assignment__c extends IFSObject {
    SAJ_App__c: string;
    SAJ_Environment__c: string;
    SAJ_Analyze_Job__c: string;
    SAJ_Operation__c: string;
    SAJ_Enabled__c: boolean;
    SAJ_Cron__c: string;

    SAJ_Analyze_Job__r: IFSAJ_Analyze_Job__c;
    SAJ_App__r: IFSAJ_App__c;
}

// tslint:disable-next-line: class-name
export interface IFSAJ_Analyze_Result__c extends IFSObject {
    SAJ_Severity__c?: SEVERITY;
    SAJ_Parent__c?: string;
    SAJ_Report__c?: boolean;
    SAJ_Passed__c?: boolean;
    SAJ_Violation_Reason__c?:string;
    SAJ_Release_Component__c?: string;
    SAJ_Release__c?: string;
    SAJ_Analyze_Job_Assignment__c?: string;
    SAJ_Analyze_Job__c?: string;
    SAJ_Environment__c?: string;
    SAJ_App__c?: string;
    SAJ_Message__c?: string;
    SAJ_Short_Message__c?: string;
    SAJ_Exec_Time__c?: number;
    SAJ_Total_Time__c?: number;
    SAJ_Exception__c?:string;
}

export interface IFSAJ_JOb_Message{
    SAJ_compId__c?:string;
    SAJ_violationReasion__c?:string;
    SAJ_severity__c?:string;
    SAJ_message__c?:string;
    SAJ_exceptionAvailable__c?:boolean;
    SAJ_Exception__c?:string;
}

export interface IFUser extends IFSObject {
    username?: string;
}

export interface IFMetadata {
    fullname: string;
}

export interface IFLocalFile {
    compName?: string;
    fullPath?: string;
    isDataLoaded?: boolean;
    fileData?: string;
    directory?: string;
    fileType?: string;
    isFileSupported?: boolean;
}
export interface IFViolation {
    violationName?: string;
    violationType?: string;
    violationFile?: string;
    violationLineNo?: number;
    nodeEntry?: any;
    xPathExp?: string;
    xPathError?: string;
    isXPathValid?: boolean;
}
export interface IFException{
    exceptionName?:string;
    ExceptionId?:string;
    ExceptionJA?:string;
    ExceptionApp?:string;
    ExceptionRN?:string;
    ExceptionCN?:string;
    ExceptionOT?:string;
}

export interface IFExceptionData{
    JobAssignmentName?:String;
    Exceptions?:IFException[];
    ExceptionComps?:string[];
}