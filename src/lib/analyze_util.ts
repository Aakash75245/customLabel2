import { isNullOrUndefined } from 'util';
import { IFExceptionData,IFException,IFerror, IFQuery, IFSObject } from './analyze_object_definition';
import { DoaspasShared } from './analyze_definition';
import { SfdxProject } from '@salesforce/core';
import * as fs from 'fs-extra';

import * as path from "path";

export async function fnRetrieveActiveJobs(): Promise <string> {

    return null;
}

// tslint:disable-next-line: no-any
export async function fnDelete(lid: string[]): Promise<string> {
  const pJobs = new Array();

  const i: number = lid.length % 200;
  const j: number = lid.length / 200;
  let k: number = 0;

  for (let f = 1; f < j; f++ ) {

    const tlid1: string[] = [];
    for (let f2 = k ; f2 < k + 200 ; f2++) {
      tlid1.push(lid[f2]);
    }
    k += 200;
    pJobs.push(DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', tlid1));
  }

  const tlid2: string[] = [];
  for (let f = k; f < k + i; f++) {
    tlid2.push(lid[f]);
  }
  pJobs.push(DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', tlid2));

  await Promise.all(pJobs);

  return 'OK';
}

export async function fnBuildSoql(v: IFQuery): Promise <string> {

  let q: string = 'select ';
  if (isNullOrUndefined(v.field)) {
    v.field = new Array<string>();
    const des = await v.conn.describe(v.object);
    for (const ff of des['fields']) {
      v.field.push(ff.name);
    }
    if (v.field.length === 0) v.field.push('Id');
  }

  q += v.field.join(',') + ' from ' + v.object;
  if (v.where != null ) q += ' where ' + v.where;
  if(DoaspasShared.isForDelete){
    q += ' limit ' + (199).toString();  
  }else if (v.limit != null) q += ' limit ' + v.limit.toString();

  return q;
}

export function fnGetAllId(v: IFSObject[]): string[] {
  const r = new Array<string>();
  for (const f of v) {
    r.push(f.Id);
  }
  return r;
}

// tslint:disable-next-line: no-any
export function fnResultMessage(v: any): string {
  let message = '';
  if (!fnResultSuccess(v)) {
    for (const f of fnResultErrorMsg(v)) {
        message += ( '\n' + 'index: ' + f.idx + ' - ' + f.statusCode + ':' + f.message);
    }
  }
  return message;
}

export function fnResultSuccess(v): boolean {
    let res: boolean = true;
    if ( isNullOrUndefined(v[0])) {
      res = v['success'];
    } else {
      for (const f of v) {
       res = res && f['success'];
      }
    }
    return res;
  }

export function fnResultErrorMsg(v): IFerror[] {
    let idx: number = 0;
    const res: IFerror[] = new Array();
    if ( isNullOrUndefined(v[0])) {
        res.push({idx, message: v['message'], statusCode: v['statusCode'], fields: v['fields']});
    } else {
        for (const f of v) {
         if (!f['success']) {
             for (const f2 of f['errors']) {
                res.push({idx, message: f2['message'], statusCode: f2['statusCode'], fields: f2['fields']});
             }
         }
         idx++;
        }
    }
    return res;
  }

  /**
 * Gets the absolute path of the current project
 */
export async function getAbsolutePath() : Promise<string> {
  let projectPath;
  try {
      projectPath = SfdxProject.resolveProjectPath();
  } catch (err) {
      if (err) {
          projectPath = '';
      }
  }
  return projectPath;
}

/**
 * Retrieves names of files in specified directory
 * @param dirPath Directory path from which to get backup files
 * @returns Array of backup file names
 */
export async function getFilesFromDirectory(dirPath: string): Promise<string[]> {
  const filenames: string[] = fs.readdirSync(dirPath);
  const backupFiles = filenames.filter(fileName => {
      return fileName.includes('.xml');
  });
  return backupFiles;
}

/**
 * Retrieves names of files in specified directory for standard objects
 * @param dirPath Directory path from which to get backup files
 * @returns Array of backup file names
 */
export async function getObjectFilesForStandardObjects(dirPath: string): Promise<string[]> {
  const filenames: string[] = fs.readdirSync(dirPath);
  let allFiles : string[] = new Array();
  filenames.filter(fileName => {
    fileName.includes('.xml') ? allFiles.push(fileName) : fileName;
  });
  const dirFiles : string[] = <string[]>filenames.filter(fileName => {
    return !fileName.includes('.xml');
  });
  
  dirFiles.forEach(element => {
    if(DoaspasShared.standardObject.indexOf(element) > -1) {
      const newPath = path.join(dirPath, element);
      const filenames: string[] = fs.readdirSync(newPath);
      filenames.filter(fileName => {
       fileName.includes('.xml') ? allFiles.push(element+'/'+fileName) : fileName;
      });
    }
  });
  return allFiles;
}

/**
 * Reads the contents of an XML file
 * @param xmlFile File to read
 * @returns File contents as string
 */
export async function readXml(xmlFile: string): Promise<string> {
  const xml: string = fs.readFileSync(xmlFile, { encoding: 'utf-8' });
  return xml;
}

export async function getSubsetCompOnDir(dir: string, relComps: IFSObject[]): Promise<Array<IFSObject>> {
  function isFromDirectory(element, index, array) { 
    return (element.Name.startsWith(dir));
  }
  var relComps = relComps.filter(isFromDirectory);

  return relComps;
}

export async function getSubsetStandardObjComp(dir: string, relComps: IFSObject[]): Promise<Array<IFSObject>> {
  function isFromDirectory(element, index, array) {
    if(element.Name.startsWith(dir) === true) {
      var objectName = element.Name.split("/")[1];
      if(DoaspasShared.standardObject.indexOf(objectName) > -1 && element.Name.split("/")[2].startsWith(objectName)) {
        // console.log('Valid Element: '+ element.Name);
        return element;
      }
    }
  }
  var relComps = relComps.filter(isFromDirectory);

  return relComps;
}

//Right all your common function or business logic here


//Function to Convert Map into JSON, this we will pass as a response
export function convertToJSONString(Map){
  let validCompJSONObj = {};
  Map.forEach((value, key) => {  
  validCompJSONObj[key] = value  
  }); 
  return JSON.stringify(validCompJSONObj);
}

export let var_slash = '\\'
//Convert JSON To Map
export function convertJSONToMap(jsonObject){
  let map = new Map<string, String>();
  for (var value in jsonObject) {  
      map.set(value,jsonObject[value])  
      }
      return map;
}

//Prepare Message for Analyze Result
export function prepareMessage(ExceptionAvailable,actualMessage){
  const myMessages:JSON = <JSON><unknown>{        
      "Dev_Prefix":DoaspasShared.build.SAJ_Application__r.SAJ_Project_Dev_Prefix__c,
      "Allowed_Prefix":DoaspasShared.build.SAJ_Application__r.SAJ_Project_Allowed_Prefix__c,
      "Reason_For_Failure": actualMessage,
      "Exception_Available":ExceptionAvailable        
    }
    return myMessages;
}

//Prepare JSON Message to Pass to Result/Template
export function prepareJSONMessage(jobName,var_ComponentId,var_componentName,var_severity,var_messages,var_isExceptionAvailable):string{
  let message = DoaspasShared.jobMessage;                        
                      message.SAJ_compId__c = var_ComponentId;
                      message.SAJ_Exception__c=DoaspasShared.Id_Of_Exception;
                      if(var_severity!=null || var_severity!=''){
                          message.SAJ_severity__c = var_severity;
                      }
                      //message.SAJ_violationReasion__c = var_violationReason;
                      message.SAJ_violationReasion__c = prepareViolationKey(jobName,var_componentName,DoaspasShared.build.Name,DoaspasShared.buildcompenv[0].SAJ_Environment__r.SAJ_Type__c);
                      message.SAJ_message__c = var_messages;                        
                      if(var_isExceptionAvailable!=null || var_isExceptionAvailable!=''){
                          message.SAJ_exceptionAvailable__c = var_isExceptionAvailable;
                      }                        
    return JSON.stringify(message);
}

//Prepare Violation Key
export function prepareViolationKey(jobName,var_componentName,var_buildName,var_orgType){ 
  //var_componentName = var_componentName.replace(/[[\]\\]/g, '\\\\')     
  let violationKey = `{"JA":"${jobName}","AP":"${DoaspasShared.build.SAJ_Application__r.Name}","RN":"${var_buildName}","CN":"${var_componentName}","OT":"${var_orgType}"}`
  return violationKey;
}
//Prepare Map Of Exception
export function prepareMapOfException(exceptionValues){
  //let exceptionPrefix:string[]=[];  
  let jobAssignmentList=[];
  let SAJ_Exception:IFException[]=[];
  let AllJobExceptions:IFExceptionData[]=[];
  let mapOfException = new Map<String,String>(); 
  let ExceptionMap = new Map<String,IFException[]>();   
  exceptionValues.forEach(exceptions => {

      var jsonString = String.raw`${exceptions.SAJ_Exception_Value__c}`;
      jsonString = jsonString.split("\\").join("\\\\");
      var jsonObj = JSON.parse(jsonString);
      if(jsonObj.RN==DoaspasShared.build.Name || jsonObj.RN=='All'){
          mapOfException.set(jsonObj,exceptions.Id); 
          SAJ_Exception.push({
              exceptionName:exceptions.Name,
              ExceptionId:exceptions.Id,
              ExceptionJA:jsonObj.JA,
              ExceptionApp:jsonObj.AP,
              ExceptionRN:jsonObj.RN,
              ExceptionCN:jsonObj.CN,
              ExceptionOT:jsonObj.OT                
              })
          if(!jobAssignmentList.includes(jsonObj.JA)){
              jobAssignmentList.push(jsonObj.JA);
          }
      }                
  });
  for(let i=0;i<jobAssignmentList.length;i++){
      let jobException : IFExceptionData = {
        JobAssignmentName:jobAssignmentList[i],
        Exceptions: new Array(),
        ExceptionComps: new Array()
        }    
        for(let j=0;j<SAJ_Exception.length;j++)
        {
            if(jobAssignmentList[i]==SAJ_Exception[j].ExceptionJA){
                
                jobException.Exceptions.push(SAJ_Exception[j]);
                jobException.ExceptionComps.push(SAJ_Exception[j].ExceptionCN);
                jobException.JobAssignmentName=jobAssignmentList[i];
            }
        }        
        AllJobExceptions.push(jobException);
    }
    //console.log(DoaspasShared.AllJobExceptions);
    AllJobExceptions.forEach(ex => {
        if(!ExceptionMap.has(ex.JobAssignmentName)){
            ExceptionMap.set(ex.JobAssignmentName,ex.Exceptions);
        }
    });  
  return ExceptionMap;
}

export function LookForException(jobName,var_ReleaseComponent){
  let exceptionFound:boolean = false;
  if(DoaspasShared.mapOfException.has(jobName)){
      let exceptionData = DoaspasShared.mapOfException.get(jobName);
      for(let i=0;i<exceptionData.length;i++){
          if(var_ReleaseComponent==exceptionData[i].ExceptionCN){
              DoaspasShared.Id_Of_Exception = exceptionData[i].ExceptionId;
              console.log(`Exception Found for JOb ${jobName} and for Component ${exceptionData[i].ExceptionCN}`)
              exceptionFound = true;
              break;
              
          }
      }
      if(exceptionFound){
          return true;
      }else{
          return false;
      }
  }       
}
