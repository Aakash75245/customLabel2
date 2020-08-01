import { Connection } from '@salesforce/core';
import { DoaspasBuildJob,DoaspasShared } from '../lib/analyze_definition';
import { IFSAJ_Release_Component__c, IFViolation } from '../lib/analyze_object_definition'
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';
import { getSubsetCompOnDir,prepareMessage } from "../lib/analyze_util";

class ResultMap {
    compName: string;
    compId: string;
    violations: string;
    isPass: boolean;
    severity:number;
}

export default class customLabel2 extends DoaspasBuildJob {

    public static runLocal: boolean = true;
    public results: ResultMap[] = new Array<ResultMap>();

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate2> {
        //console.log('\n'+JSON.stringify(DoaspasXPathShared.localFiles));
        console.log ('JOB ID:' + this.ref);
        //let mySettingData = settingsJsonObj.AllSettings;
        //console.log(settingsJsonObj.MetaDataInfo.settingsData);
        //console.log('XPath: '+this.field.XPath);

        this.result = new JobResultTemplate2(this);

        try {
            let subsetPermReleaseComps : IFSAJ_Release_Component__c[] = <IFSAJ_Release_Component__c[]> await getSubsetCompOnDir('labels', DoaspasShared.buildcomp);
            console.log('Subset label Release Comp: '+ subsetPermReleaseComps);
            this.results = await this.runOWDMonitoringJob(subsetPermReleaseComps);
            // console.log('Results: '+this.results);
            console.log('Inserting Data Now');
            for(let value of this.results) {
                let message : string;
                if(!value.isPass) {                    
                    message = value.violations;
                    DoaspasShared.jobPassed = false;
                    DoaspasShared.buildPassed = false;
                } else {
                    message = value.violations;
                }                
                // console.log('Error message: '+message);
                this.result.data.push({Name:`CUSTOM LABEL CHECK 2 - ${this.ref}`,
                SAJ_Message__c:message,
                SAJ_Release_Component__c:value.compId,
                SAJ_Passed__c:value.isPass,
                SAJ_Severity__c:value.severity});
                // console.log('########Result Pushed: '+this.result.data);
            }

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }
        // ### Store the results on App Central
        //await this.result.Process();

        return this.result;
    }


    public async runOWDMonitoringJob(compDetails:IFSAJ_Release_Component__c[]): Promise<Array<ResultMap>> {
        let results: ResultMap[] = new Array<ResultMap>();

        try{
            // let unionExpression: string = await this.constructObjectPermissionsXPath() + " | " + await this.constructUserPermissionXPath(violations);
            for(let comp of compDetails) {
                
                //if(!comp.Name.includes('CustomLabels.labels')){
                    console.log('Iterating for Component ' + comp.Name);
                    //console.log('****Comp Name: '+comp.Name);
                    //console.log('****XPath to test: '+ this.field.Parameter1);
                    let violationResults: IFViolation[] = await DoaspasShared.doaspasXPath.findViolationsAtXPath(this.field.Parameter1, comp.Name);
                    console.log('****All Violations: '+violationResults);
                    violationResults.forEach(res => {
                        //console.log(res);
                        console.log(res.nodeEntry.firstChild.nodeValue);
                        //console.log(res.nodeEntry.firstChild);
                    });
                    let message='';
                    console.log(violationResults.length);
                    if(violationResults.length==1){
                        /* message = 'Name Matched with Label';
                        console.log(message);
                        console.log(comp.Name.split('/')[1].split('.')[0]);
                        console.log(violationResults[0].nodeEntry.firstChild.nodeValue)
                        if(comp.Name.split('/')[1].split('.')[0]==violationResults[0].nodeEntry.firstChild.nodeValue){
                            let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:message, isPass:true,severity:1};
                            results.push(resultVal);
                        }else{
                            message = 'Name not matching ';
                            console.log(message);
                            let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:message, isPass:false,severity:4};
                            results.push(resultVal);
                        } */
                        message = JSON.stringify(prepareMessage(false,'NA'));
                        let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:message, isPass:true,severity:null};
                        results.push(resultVal);
                    }
                    if(violationResults.length > 1) {
                        message = JSON.stringify(prepareMessage(false,'More Than one custom Label entries'));
                        console.log(message);
                        let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:message, isPass:false,severity:5};
                        results.push(resultVal);
                    }
                    if(violationResults.length == 0) {
                        message = JSON.stringify(prepareMessage(false,'No entries found'));
                        console.log(message);
                        let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:message, isPass:false,severity:5};
                        results.push(resultVal);
                    }
                //}
            }
        } catch(error) {
            console.log('No Build Release Records available' + error.message);
          }  
          return results;
    }
}