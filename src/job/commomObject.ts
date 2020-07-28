import { Connection } from '@salesforce/core';
import { DoaspasBuildJob,DoaspasShared } from '../lib/analyze_definition';
import { var_slash,prepareMessage,convertJSONToMap,prepareJSONMessage,convertToJSONString, LookForException } from '../lib/analyze_util';
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';

export default class CommonObject extends DoaspasBuildJob {
    public static runLocal: boolean = true;
    constructor(conn: Connection, job: IFJob)
     {
        super(job);
    }
    
    public async run(): Promise<JobResultTemplate2> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate2(this);

        try {           
            let mapOfValidComp = new Map<String,String>();
            let mapOfNotValidComp = new Map<String,String>();

            // Calling Check Prefix Plugins  
            let resultOfCheckPrefix = await runCommonObjectJob(this.field.AssignmentJobName);                   

            mapOfValidComp = convertJSONToMap(JSON.parse(resultOfCheckPrefix['validComp']));
            mapOfNotValidComp = convertJSONToMap(JSON.parse(resultOfCheckPrefix['NotValidComponent']));            
            DoaspasShared.jobPassed = true;
            //DoaspasShared.buildPassed = true;

            //Create Result for Not Valid Components
            if(mapOfNotValidComp.size>0){                
                for(let key of mapOfNotValidComp.keys()){
                    let messageInfo = JSON.parse(<string>mapOfNotValidComp.get(key));                                       
                    let myMessage = prepareMessage(messageInfo.SAJ_exceptionAvailable__c,messageInfo.SAJ_message__c);
                    this.result.data.push({Name:`COMMON OBJECT CHECK - ${this.ref}`,
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
                this.result.data.push({Name:`COMMON OBJECT CHECK - ${this.ref}`,
                SAJ_Message__c:JSON.stringify(myMessage),
                SAJ_Exception__c:messageInfo.SAJ_Exception__c,
                SAJ_Release_Component__c:`${messageInfo.SAJ_compId__c}`,
                SAJ_Severity__c:messageInfo.SAJ_severity__c,
                SAJ_Passed__c:true});                
            }

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }
        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }

}
//Common Object Function
export function runCommonObjectJob(jobName): any {
    try{
        
        let typeToCompare = var_slash+'objects'+var_slash;
        DoaspasShared.mapOfNotValidComponentList.clear(); 
        DoaspasShared.mapOfValidComponentsList.clear();

        //Declare Map Variables                        
        let mapOfStandardObjects = new Map<String,boolean>();                    

        //Prepare Map of Standard Objects
        DoaspasShared.standardObject.forEach(standardObjects => {
            mapOfStandardObjects.set(standardObjects,true);
        });

        DoaspasShared.buildcomp.forEach(componentRecords => { 
            let exceptionAvailable = false;
            if(componentRecords.SAJ_Component_Full_Name__c.includes(typeToCompare)){
                let compTypeName;
                compTypeName = componentRecords.SAJ_Component_Full_Name__c.split(var_slash)[2];
                if(mapOfStandardObjects.has(compTypeName)){ 
                    exceptionAvailable = false;                   
                    exceptionAvailable = LookForException(jobName,componentRecords.Name);
                    if(!exceptionAvailable){
                        let JsonMessage = prepareJSONMessage(jobName,componentRecords.Id,componentRecords.Name,'5','It Belongs to Standard Object, No Exception Available',false);
                        DoaspasShared.mapOfNotValidComponentList.set(componentRecords.Name,JsonMessage);
                    }else{
                        let JsonMessage = prepareJSONMessage(jobName,componentRecords.Id,componentRecords.Name,'','It Belongs to Standard Object, But Exception Available',true);
                        DoaspasShared.mapOfValidComponentsList.set(componentRecords.Name,JsonMessage);
                    }
                }else{
                    if(!DoaspasShared.mapOfValidComponentsList.has(componentRecords.Name)){
                        let JsonMessage = prepareJSONMessage(jobName,componentRecords.Id,componentRecords.Name,'','NA',false);                           
                        DoaspasShared.mapOfValidComponentsList.set(componentRecords.Name,JsonMessage);
                    }
                }                    
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
        
        console.log('No Build Release Records available' + error.message);
    }     
}


