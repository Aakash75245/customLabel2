import { Connection } from '@salesforce/core';
import { DoaspasBuildJob,DoaspasShared } from '../lib/analyze_definition';
import { IFSAJ_Release__c,IFSAJ_Release_Component__c } from '../lib/analyze_object_definition'
import {  IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';
import { LookForException,prepareMessage,convertJSONToMap,prepareJSONMessage,convertToJSONString } from '../lib/analyze_util';
//import { baseElement,mappingInfos,mixedComponent,defaultIndex,objectType,checkLastIndex,specialType,excludeComponent } from '../data/indexMappingInfo';
//import * as configData from "../data/JobConfigData.json";
import * as prefixRule from "../data/PrefixJson.json"
import * as ConfigData from "../data/AllJobConfigData.json"
import { isNullOrUndefined } from 'util';

export default class Prefix extends DoaspasBuildJob {
   public static runLocal: boolean = false;
    constructor(conn: Connection, job: IFJob) {        
        super(job);
    }

    public async run(): Promise<JobResultTemplate2> {
        console.log ('JOB ID:' + this.ref);
        console.log(this.field.AssignmentJobName)
        //console.log(settingsJsonObj);
        this.result = new JobResultTemplate2(this);
        try {

            //Declare Variables             
            let mapOfValidComp = new Map<String,String>();
            let mapOfNotValidComp = new Map<String,String>();            

            // Calling Check Prefix Plugins Job 
            let resultOfCheckPrefix = await runPrefixCheck(this.field.AssignmentJobName,DoaspasShared.buildcomp,DoaspasShared.build,DoaspasShared.standardObject);    

            // Call Function to convert JSON Object to Map                   
            mapOfValidComp = convertJSONToMap(JSON.parse(resultOfCheckPrefix['validComp']));
            mapOfNotValidComp = convertJSONToMap(JSON.parse(resultOfCheckPrefix['NotValidComponent']));
            
            //Set By Default Build and Job Summary as Passed
            DoaspasShared.jobPassed = true;
            //DoaspasShared.buildPassed = true;
             
            //Create Result for Not Valid Components
            if(mapOfNotValidComp.size>0){                
                for(let key of mapOfNotValidComp.keys()){
                    let messageInfo = JSON.parse(<string>mapOfNotValidComp.get(key));                                       
                    let myMessage = prepareMessage(messageInfo.SAJ_exceptionAvailable__c,messageInfo.SAJ_message__c);
                    this.result.data.push({Name:`Prefix Check JOB - ${this.ref}`,
                    SAJ_Message__c:JSON.stringify(myMessage),
                    SAJ_Release_Component__c:`${messageInfo.SAJ_compId__c}`,
                    SAJ_Passed__c:false,
                    SAJ_Severity__c:messageInfo.SAJ_severity__c,
                    SAJ_Violation_Reason__c:messageInfo.SAJ_violationReasion__c});                    
                }
                DoaspasShared.jobPassed = false;
                DoaspasShared.buildPassed = false;
            }

            //Create Result for Valid Components
            for(let key of mapOfValidComp.keys()){
                let messageInfo = JSON.parse(<string>mapOfValidComp.get(key)); 
                let myMessage = prepareMessage(messageInfo.SAJ_exceptionAvailable__c,messageInfo.SAJ_message__c);                
                this.result.data.push({Name:`Prefix Check JOB - ${this.ref}`,
                SAJ_Message__c:JSON.stringify(myMessage),
                SAJ_Release_Component__c:`${messageInfo.SAJ_compId__c}`,
                SAJ_Severity__c:messageInfo.SAJ_severity__c,
                SAJ_Passed__c:true});                
            }            

        } catch (e) {
            console.log('Error' + e);
            this.result.summary.message = (e as Error).message;
        }

        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }
    
}
    function runPrefixCheck(jobName,compDetails:IFSAJ_Release_Component__c[],appDetails:IFSAJ_Release__c,standardObject:string[]): any {
        try{  
            
            //Clear Valid and Not-Valid Maps
            DoaspasShared.mapOfNotValidComponentList.clear(); 
            DoaspasShared.mapOfValidComponentsList.clear();

            //Declare Map Variables                    
            let mapOfBucket = new Map<String,String>();
            let mapOfStandardObjects = new Map<string,boolean>();
            let mapOfAppPrefix = new Map<string,boolean>();        

            //Declare Prefix,MappingFile and Exception Variables
            let appPrefixList;                 
            //let mappingFile = configData.MappingInfo.IndexInfo[0];
            //console.log(mappingFile['objects'].Index);
            
            //Declare Variable For Indexing and ComponentToCompare 
            let var_Object_Index:number;
            let var_Component_Index:number;
            let var_Main_Index:number;
            let var_Last_Index_Of:number;
            let var_Length_Of_Component:number;
            let var_Object_To_Compare:string;
            let var_Component_To_Compare:string;
            let var_Full_Component_Name:string;
            

            //Prepare Map of App Prefix
            appPrefixList = appDetails.SAJ_Application__r.SAJ_Project_Allowed_Prefix__c.split(',');                   
            appPrefixList.push(appDetails.SAJ_Application__r.SAJ_Project_Dev_Prefix__c);// eg: TPM       
            appPrefixList.forEach(appPrefix => {
                mapOfAppPrefix.set(appPrefix,true);
            });                        
        
            //Prepare Map of Standard Objects
            DoaspasShared.standardObject.forEach(standardObject => {
                mapOfStandardObjects.set(standardObject,true);
            });
        
            //Iterate all components and get the index infromation 
            compDetails.forEach(releaseComponentName => { 
                //console.log('****************8Working on Component ' + releaseComponentName.Name);                           
                const typeOfComponent = releaseComponentName.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[prefixRule.BaseDirectoryIndex];  
                mapOfBucket = prepareMapOfBuckets();  
                //console.log(mapOfBucket); 
                const compareCompType = mapOfBucket.get(typeOfComponent);
                //console.log(` ${prefixRule.BaseDirectoryIndex}  ************* JSON DATA FOR : ${compareCompType} IS : `);
                //let JSONData =  getIndexData(typeOfComponent); 
                let JSONData : object = getIndexDataAt(prefixRule.IndexInfo, 'type',typeOfComponent);
                /* if(!isNullOrUndefined(JSONData)){
                    console.log(`${typeOfComponent} JSON Data is ${JSONData}`);
                    console.log('Type: '+JSONData['type']);
                    console.log(JSONData['type']+ ' ComponentIndex: '+JSONData['ComponentIndex']);
                    console.log(JSONData['type']+ ' StandardObjectIndex: '+JSONData['StandardObjectIndex']);
                    console.log(JSONData['type']+ ' ChildMetadataIndex: '+JSONData['ChildMetadataIndex']);
                } */
                //console.log(JSONData);
                switch(compareCompType) {                     
                    case 'objectType': {  
                        // console.log(`JSON Data For ${typeOfComponent} IS : `);
                        // console.log(JSONData);
                        var_Object_Index = JSONData['StandardObjectIndex'];
                        var_Component_Index = JSONData['ChildMetadataIndex'];
                        var_Object_To_Compare = releaseComponentName.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[var_Object_Index];                    
                        var_Component_To_Compare = releaseComponentName.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[var_Component_Index];
                        if(mapOfStandardObjects.has(var_Object_To_Compare)){
                            PrepareValidNotValidCompMap(jobName,var_Component_To_Compare,mapOfAppPrefix,releaseComponentName);
                        }else{
                            PrepareValidNotValidCompMap(jobName,var_Object_To_Compare,mapOfAppPrefix,releaseComponentName);
                        }
                    break; 
                    } 
                    case 'mixedComponent': { 
                        //Declare Variable : 
                        // console.log(`JSON Data For ${typeOfComponent} IS : `);
                        // console.log(JSONData);
                        var_Main_Index = JSONData['ComponentIndex'];
                        var_Full_Component_Name = releaseComponentName.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[var_Main_Index]; 
                        var_Object_Index =  JSONData['StandardObjectIndex'];
                        var_Component_Index =  JSONData['ChildMetadataIndex'];
                        var_Object_To_Compare = var_Full_Component_Name.split('.')[var_Object_Index];
                        var_Component_To_Compare = var_Full_Component_Name.split('.')[var_Component_Index];
                        if(mapOfStandardObjects.has(var_Object_To_Compare)){
                            //Component is belongs to Standard Object hence check for Component Prefix  
                            PrepareValidNotValidCompMap(jobName,var_Component_To_Compare,mapOfAppPrefix,releaseComponentName);                                            
                        }else{
                            //Component is belongs to Custom Object hence check for Object Prefix
                            PrepareValidNotValidCompMap(jobName,var_Object_To_Compare,mapOfAppPrefix,releaseComponentName);
                        }
                    //statements; 
                        break; 
                    }
                    case 'checkLastIndex': { 
                        //statements; 
                        var_Last_Index_Of = releaseComponentName.SAJ_Component_Full_Name__c.lastIndexOf(ConfigData.VAR_SLASH)+1;
                        //console.log(releaseComponentName.SAJ_Component_Full_Name__c);
                        var_Length_Of_Component = releaseComponentName.SAJ_Component_Full_Name__c.length; 
                        //console.log('Length is ' + var_Length_Of_Component);                   
                        var_Component_To_Compare = releaseComponentName.SAJ_Component_Full_Name__c.substr(var_Last_Index_Of,var_Length_Of_Component);
                        if(!isNullOrUndefined(var_Component_To_Compare)){
                            PrepareValidNotValidCompMap(jobName,var_Component_To_Compare,mapOfAppPrefix,releaseComponentName);                                                                                                                                                                                                                           
                        }else{
                            var_Component_To_Compare = releaseComponentName.SAJ_Component_Full_Name__c.substr(0,var_Last_Index_Of-1);
                            //console.log(releaseComponentName.SAJ_Component_Full_Name__c);
                            var_Length_Of_Component = var_Component_To_Compare.length;
                            var_Last_Index_Of = var_Component_To_Compare.lastIndexOf(ConfigData.VAR_SLASH)+1;
                            var_Component_To_Compare = releaseComponentName.SAJ_Component_Full_Name__c.substr(var_Last_Index_Of,var_Length_Of_Component);
                            PrepareValidNotValidCompMap(jobName,var_Component_To_Compare,mapOfAppPrefix,releaseComponentName);
                        }
                        break; 
                    }                 
                    case 'specialType': { 
                        // console.log(`JSON Data For ${typeOfComponent} IS : `);
                        // console.log(JSONData);
                        var_Main_Index = JSONData['ComponentIndex'];
                        var_Full_Component_Name = releaseComponentName.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[var_Main_Index]; 
                        var_Object_Index =  JSONData['StandardObjectIndex'];
                        var_Component_Index =  JSONData['ChildMetadataIndex'];
                        var_Object_To_Compare = var_Full_Component_Name.split('-')[var_Object_Index];                
                        var_Component_To_Compare = var_Full_Component_Name.split('-')[var_Component_Index];                                    
                        if(mapOfStandardObjects.has(var_Object_To_Compare)){                        
                                PrepareValidNotValidCompMap(jobName,var_Component_To_Compare,mapOfAppPrefix,releaseComponentName);
                        }else{
                                PrepareValidNotValidCompMap(jobName,var_Object_To_Compare,mapOfAppPrefix,releaseComponentName);
                        }
                        //statements; 
                        break; 
                    }                 
                    case 'excludeComponent': { 
                        let JsonMessage = prepareJSONMessage(jobName, releaseComponentName.Id,releaseComponentName.Name,'','Not Checking As Part Of Prefix Check Job',false);
                        DoaspasShared.mapOfValidComponentsList.set(releaseComponentName.Name,JsonMessage);
                        //statements; 
                        break; 
                    } 
                    default: { 
                                let compName = releaseComponentName.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[prefixRule.DefaultComponentIndex];
                                PrepareValidNotValidCompMap(jobName,compName,mapOfAppPrefix,releaseComponentName);
                        //statements;  
                    break; 
                    } 
                }                                                            
        });
        DoaspasShared.buildcomp.forEach(comp => {
            if(!DoaspasShared.mapOfValidComponentsList.has(comp.Name) && !DoaspasShared.mapOfNotValidComponentList.has(comp.Name)){
                console.log(`Component is not added to Result ${comp.Name}`);
            }
        });
        console.log(DoaspasShared.mapOfValidComponentsList.size);     
        console.log(DoaspasShared.mapOfNotValidComponentList.size);
        //Function to Convert Map into JSON, this we will pass as a response
        let validCompJson = convertToJSONString(DoaspasShared.mapOfValidComponentsList);
        let notValidCompJson =convertToJSONString(DoaspasShared.mapOfNotValidComponentList); 
        return { validComp : `${validCompJson}`,NotValidComponent : `${notValidCompJson}`};
    }                                
    catch(error)
    {
          console.log('No Build Release Records available' + error);
    }   
}

//Function To Prepare Valid-NotValid Component Map
function PrepareValidNotValidCompMap(jobName,componentName,mapOfAppPrefix,releaseComponentName){
    let prefixForMap = '';
    let message;
    let sev;    
    let ExceptionAvailable:boolean = false;
    let exception:boolean=false;
    let AppPrefixAvailable:boolean=false;
    if(!isNullOrUndefined(componentName)){
        if(componentName.includes('_')){
            prefixForMap =  componentName.split('_')[0];
            if(mapOfAppPrefix.has(prefixForMap)){
                //Components Having AppPrefix                
                AppPrefixAvailable = true;
                message = ' App Prefix Available';
                        sev = '';
                        exception=false;
                        let JsonMessage = prepareJSONMessage(jobName, releaseComponentName.Id,releaseComponentName.SAJ_Component_Full_Name__c,sev,message,exception);
                        DoaspasShared.mapOfValidComponentsList.set(releaseComponentName.Name,JsonMessage);
            }else{
                if(!AppPrefixAvailable){
                    ExceptionAvailable = LookForException(jobName, releaseComponentName.Name);
                    if(!ExceptionAvailable){
                        message = ' Prefix Mismatch and No Exception Found';
                        sev = '5';
                        exception=false;
                        let JsonMessage = prepareJSONMessage(jobName, releaseComponentName.Id,releaseComponentName.SAJ_Component_Full_Name__c,sev,message,exception);
                        DoaspasShared.mapOfNotValidComponentList.set(releaseComponentName.Name,JsonMessage);
                    }else{
                        message = ' We Found Exception For This COmponent';
                        sev = '';
                        exception=true;
                        let JsonMessage = prepareJSONMessage(jobName, releaseComponentName.Id,releaseComponentName.SAJ_Component_Full_Name__c,sev,message,exception);
                        DoaspasShared.mapOfValidComponentsList.set(releaseComponentName.Name,JsonMessage);
                    }
                }
            }
        }else{

            ExceptionAvailable = LookForException(jobName, releaseComponentName.Name);
                    if(!ExceptionAvailable){
                        message = ' but dont have prefix at all, hence failed';
                        sev = '5';
                        let JsonMessage = prepareJSONMessage(jobName, releaseComponentName.Id,releaseComponentName.SAJ_Component_Full_Name__c,sev,message,exception);
                        DoaspasShared.mapOfNotValidComponentList.set(releaseComponentName.Name,JsonMessage);
                    }else{
                        message = ' We Found Exception For This COmponent';
                        sev = '';
                        exception=true;
                        let JsonMessage = prepareJSONMessage(jobName, releaseComponentName.Id,releaseComponentName.SAJ_Component_Full_Name__c,sev,message,exception);
                        DoaspasShared.mapOfValidComponentsList.set(releaseComponentName.Name,JsonMessage);
                    }            
            }
    }
}

//Function To Prepare Map Of Brackets From Mapping File
function prepareMapOfBuckets(){  
    let mapOfBucket = new Map<String,String>();  
    
    prefixRule.DotNotationComps.forEach(compType => {
        mapOfBucket.set(compType,'mixedComponent')
    });
    prefixRule.LastIndexComps.forEach(compType => {
        mapOfBucket.set(compType,'checkLastIndex')
    });    
    prefixRule.DashNotationComps.forEach(compType => {
        mapOfBucket.set(compType,'specialType')
    });
    prefixRule.ExcludedComps.forEach(compType => {
        mapOfBucket.set(compType,'excludeComponent')
    });
    prefixRule.ObjectComps.forEach(compType => {
        mapOfBucket.set(compType,'objectType')
    });
    DoaspasShared.buildcomp.forEach(ReleaseComponent => {
        let var_compType = ReleaseComponent.SAJ_Component_Full_Name__c.split(ConfigData.VAR_SLASH)[prefixRule.BaseDirectoryIndex];        
        if(!mapOfBucket.has(var_compType)){
            //console.log(`${var_compType} not available in any bucket`);
            mapOfBucket.set(var_compType,'default')
        }
    });
    return mapOfBucket;
}

/* function getIndexData(typeToCompare){
    let prefixJSONData = prefixRule.IndexInfo;
    for(let i=0;i<prefixJSONData.length;i++){
        if(prefixJSONData[i].type==typeToCompare){
            return prefixJSONData[i];
            break;
        }
    }    
} */

function getIndexDataAt(objs: object[], key: string, value:string): object {
    return objs.find(function(v){ return v[key] === value});
    }
