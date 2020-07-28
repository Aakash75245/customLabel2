import { Connection } from '@salesforce/core';
import { DoaspasBuildJob,DoaspasShared } from '../lib/analyze_definition';
import { prepareMessage,convertJSONToMap,prepareJSONMessage,convertToJSONString } from '../lib/analyze_util';
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate1 from '../lib/analyze_result_template1';

export default class customLabel1 extends DoaspasBuildJob {
    public static runLocal: boolean = true;
    constructor(conn: Connection, job: IFJob)
     {
        super(job);
    }
    
    public async run(): Promise<JobResultTemplate1> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate1(this);

        try {           
            let mapOfValidComp = new Map<String,String>();
            let mapOfNotValidComp = new Map<String,String>();

            // Calling Check Prefix Plugins  
            let resultOfCheckPrefix = await runCustomLabelJob(this.field.AssignmentJobName);                   

            mapOfValidComp = convertJSONToMap(JSON.parse(resultOfCheckPrefix['validComp']));
            mapOfNotValidComp = convertJSONToMap(JSON.parse(resultOfCheckPrefix['NotValidComponent']));            
            DoaspasShared.jobPassed = true;
            //DoaspasShared.buildPassed = true;

            //Create Result for Not Valid Components
            if(mapOfNotValidComp.size>0){                
                for(let key of mapOfNotValidComp.keys()){
                    let messageInfo = JSON.parse(<string>mapOfNotValidComp.get(key));                                       
                    let myMessage = prepareMessage(messageInfo.SAJ_exceptionAvailable__c,messageInfo.SAJ_message__c);
                    this.result.data.Name=`CUSTOM LABEL CHECK - ${this.ref}`;
                    this.result.data.SAJ_Message__c=JSON.stringify(myMessage);
                    this.result.data.SAJ_Release_Component__c=`${messageInfo.SAJ_compId__c}`;
                    this.result.data.SAJ_Passed__c=false;
                    this.result.data.SAJ_Severity__c=messageInfo.SAJ_severity__c;
                    this.result.data.SAJ_Violation_Reason__c=messageInfo.SAJ_violationReasion__c;                               
                }
                DoaspasShared.jobPassed = false;
                DoaspasShared.buildPassed = false;
            }

            //Create Result for Valid Components
            for(let key of mapOfValidComp.keys()){
                let messageInfo = JSON.parse(<string>mapOfValidComp.get(key)); 
                let myMessage = prepareMessage(messageInfo.SAJ_exceptionAvailable__c,messageInfo.SAJ_message__c);                
                this.result.data.Name=`CUSTOM LABEL CHECK - ${this.ref}`;
                this.result.data.SAJ_Message__c=JSON.stringify(myMessage);
                //this.result.data.SAJ_Exception__c=messageInfo.SAJ_Exception__c;
                //this.result.data.SAJ_Release_Component__c='';
                this.result.data.SAJ_Severity__c=messageInfo.SAJ_severity__c;
                this.result.data.SAJ_Passed__c=true;                
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
export function runCustomLabelJob(jobName): any {
    try{
        
        let typeToCompare = '\\labels\\CustomLabels.labels-meta.xml';        
        let JsonMessage='';
        let customLabelAvailable:boolean=false;
        //Declare Map Variables                
        //let mapOfException = new Map<String,boolean>();
        DoaspasShared.mapOfNotValidComponentList.clear(); 
        DoaspasShared.mapOfValidComponentsList.clear();

        //mapOfException = prepareMapOfException();  

        //Prepare Map of Standard Objects
        
        for(let i=0;i<DoaspasShared.buildcomp.length;i++){
            if(DoaspasShared.buildcomp[i].SAJ_Component_Full_Name__c==typeToCompare){                
                JsonMessage = prepareJSONMessage(jobName,DoaspasShared.buildcomp[i].Id,DoaspasShared.buildcomp[i].Name,'5',` ${DoaspasShared.buildcomp[i].Name} is Available`,false);                           
                DoaspasShared.mapOfNotValidComponentList.set(DoaspasShared.buildcomp[i].Name,JsonMessage);
                customLabelAvailable = true;
                break;
            }
        }
        if(!customLabelAvailable){
            JsonMessage = prepareJSONMessage(jobName,'','','',` No ${typeToCompare} Available`,false);                           
            DoaspasShared.mapOfValidComponentsList.set('No Component',JsonMessage);
        }
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


