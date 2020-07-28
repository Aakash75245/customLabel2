import { Connection } from '@salesforce/core';
import { DoaspasBuildJob,DoaspasShared } from '../lib/analyze_definition';
import { IFSAJ_Release_Component__c, IFViolation } from '../lib/analyze_object_definition'
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';
import { getSubsetStandardObjComp } from "../lib/analyze_util";

enum owdMessages {
    SHARING_MODEL_MESSAGE = 'OWD on standard object can not be changed from Private: \n'
}
class ResultMap {
    compName: string;
    compId: string;
    violations: IFViolation[];
    isPass: boolean;
}

export default class owd extends DoaspasBuildJob {

    public static runLocal: boolean = true;
    public results: ResultMap[] = new Array<ResultMap>();

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate2> {
        // console.log('\n'+JSON.stringify(DoaspasXPathShared.localFiles));
        console.log ('JOB ID:' + this.ref);
        // console.log('XPath: '+this.field.XPath);

        this.result = new JobResultTemplate2(this);

        try {
            let subsetPermReleaseComps : IFSAJ_Release_Component__c[] = <IFSAJ_Release_Component__c[]> await getSubsetStandardObjComp('objects', DoaspasShared.buildcomp);
            // console.log('Subset OWD Release Comp: '+ subsetPermReleaseComps);
            this.results = await this.runOWDMonitoringJob(subsetPermReleaseComps);
            // console.log('Results: '+this.results);

            for(let value of this.results) {
                let message : string;
                let userPermMessage : string;
                if(value.violations != undefined) {
                    for(let violat of value.violations) {
                        if(violat.violationType === "sharingModel") {
                            userPermMessage === undefined ? (userPermMessage = owdMessages.SHARING_MODEL_MESSAGE +violat.violationName+' : '+violat.violationLineNo) : (userPermMessage+= '\n '+violat.violationName+' : '+violat.violationLineNo);
                        }
                    }
                    message = userPermMessage;
                    DoaspasShared.jobPassed = false;
                    DoaspasShared.buildPassed = false;
                } else {
                    message = 'Good to Go!';
                }
                
                // console.log('Error message: '+message);
                this.result.data.push({Name:`OWD CHECK - ${this.ref}`,SAJ_Message__c:message,SAJ_Release_Component__c:value.compId,SAJ_Passed__c:value.isPass,SAJ_Severity__c:5});
                // console.log('########Result Pushed: '+this.result.data);
            }

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }
        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }


    public async runOWDMonitoringJob(compDetails:IFSAJ_Release_Component__c[]): Promise<Array<ResultMap>> {
        let results: ResultMap[] = new Array<ResultMap>();

        try{
            // let unionExpression: string = await this.constructObjectPermissionsXPath() + " | " + await this.constructUserPermissionXPath(violations);
            for(let comp of compDetails) {
                // console.log('****Comp Name: '+comp.Name);
                // console.log('****XPath to test: '+ this.field.Parameter1);
                let violationResults: IFViolation[] = await DoaspasShared.doaspasXPath.findViolationsAtXPath(this.field.Parameter1, comp.Name);
                // console.log('****All Violations: '+violationResults);
                if(violationResults.length > 0) {
                    violationResults = await this.updateViolationInfo(violationResults);
                    let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:violationResults, isPass:false};
                    results.push(resultVal);
                } else {
                    let resultVal: ResultMap = {compName:comp.Name, compId:comp.Id, violations:undefined, isPass:true};
                    results.push(resultVal);
                }
            }
        } catch(error) {
            // console.log('No Build Release Records available' + error.message);
          }  
          return results;
    }

    /**
     * Construct and update the Violation Data
     */
    
     public async updateViolationInfo(violations:IFViolation[]): Promise<Array<IFViolation>> {
         for (const violationEntry of violations) {
             if (violationEntry.nodeEntry.nodeName === "sharingModel") {
                // console.log("***********Sharing Model Violated**********");
                violationEntry.violationName = violationEntry.nodeEntry.firstChild;
                violationEntry.violationType = "sharingModel";
                violationEntry.violationLineNo = violationEntry.nodeEntry.lineNumber;
            }
        }
        return violations;
    }
}