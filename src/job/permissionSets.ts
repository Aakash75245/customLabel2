import { Connection } from '@salesforce/core';
import { DoaspasBuildJob,DoaspasShared } from '../lib/analyze_definition';
import { IFSAJ_Release_Component__c, IFViolation } from '../lib/analyze_object_definition'
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate2 from '../lib/analyze_result_template2';
import { getSubsetCompOnDir } from "../lib/analyze_util";

enum permissionType {
    OBJECT_PERMISSIONS = 'objectPermissions',
    USER_PERMISSIONS = 'userPermissions',
    GROUP_PERMISSIONS = 'Group'
}

enum permissionTypeMessage {
    OBJECT_PERMISSIONS_MESSAGE = 'Allow Delete, Modify All Records and View All Records Should be "false" for Standard Object in Object Permissions: \n',
    USER_PERMISSIONS_MESSAGE = 'Invalid System Access for user in User Permissions: \n',
    GROUP_PERMISSIONS_MESSAGE = 'Does Include Bosses Should Be false in the tag <Group>: \n'
}
class ResultMap {
    compName: string;
    compId: string;
    violations: IFViolation[];
    isPass: boolean;
}

export default class permissionSets extends DoaspasBuildJob {

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
            let subsetPermReleaseComps : IFSAJ_Release_Component__c[] = <IFSAJ_Release_Component__c[]> await getSubsetCompOnDir('permissionsets', DoaspasShared.buildcomp);
            this.results = await this.runPermissionMonitoringJob(subsetPermReleaseComps);

            for(let value of this.results) {
                let message : string;
                let userPermMessage : string;
                let objectPermMessage : string;
                let groupPermMessage : string;
                if(value.violations != undefined) {
                    for(let violat of value.violations) {
                        if(violat.violationType === permissionType.USER_PERMISSIONS) {
                            userPermMessage === undefined ? (userPermMessage = permissionTypeMessage.USER_PERMISSIONS_MESSAGE +violat.violationName+' : '+violat.violationLineNo) : (userPermMessage+= '\n '+violat.violationName+' : '+violat.violationLineNo);
                        } else if(violat.violationType === permissionType.OBJECT_PERMISSIONS) {
                            objectPermMessage === undefined ? (objectPermMessage = permissionTypeMessage.OBJECT_PERMISSIONS_MESSAGE + violat.violationName+' : '+violat.violationLineNo) : (objectPermMessage+= '\n '+violat.violationName+' : '+violat.violationLineNo);
                        } else if(violat.violationType === permissionType.GROUP_PERMISSIONS) {
                            groupPermMessage === undefined ? (groupPermMessage = permissionTypeMessage.GROUP_PERMISSIONS_MESSAGE + violat.violationName+' : '+violat.violationLineNo) : (groupPermMessage+= '\n '+violat.violationName+' : '+violat.violationLineNo);
                        }
                    }
                    message = (userPermMessage === undefined?'':userPermMessage) + '\n \n' + (objectPermMessage === undefined? '':objectPermMessage) + '\n \n' + (groupPermMessage === undefined? '':groupPermMessage);
                    DoaspasShared.jobPassed = false;
                    DoaspasShared.buildPassed = false;
                } else {
                    message = 'Good to Go!';
                }
                
                // console.log('Error message: '+message);
                this.result.data.push({Name:`PERMISSIONSET CHECK - ${this.ref}`,SAJ_Message__c:message,SAJ_Release_Component__c:value.compId,SAJ_Passed__c:value.isPass,SAJ_Severity__c:5});
                // console.log('########Result Pushed: '+this.result.data);
            }

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }
        // ### Store the results on App Central
        await this.result.Process();

        return this.result;
    }


    public async runPermissionMonitoringJob(compDetails:IFSAJ_Release_Component__c[]): Promise<Array<ResultMap>> {
        let results: ResultMap[] = new Array<ResultMap>();

        try{
            // let unionExpression: string = await this.constructObjectPermissionsXPath() + " | " + await this.constructUserPermissionXPath(violations);
            for(let comp of compDetails) {
                // console.log('Comp Name: '+comp.Name);
                let violationResults: IFViolation[] = await DoaspasShared.doaspasXPath.findViolationsAtXPath(this.field.Parameter1, comp.Name);
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
             if (violationEntry.nodeEntry.nodeName === permissionType.USER_PERMISSIONS) {
                // console.log("***********User Pemission Violated**********");
                for (let i = 0; i < violationEntry.nodeEntry.childNodes.length; i += 1) {
                    let childNode = violationEntry.nodeEntry.childNodes[i];
                    //console.log('Child Node: '+ childNode);
                    if (childNode.nodeName === "name") {
                        violationEntry.violationName = childNode.firstChild;
                        violationEntry.violationType = permissionType.USER_PERMISSIONS;
                        violationEntry.violationLineNo = childNode.lineNumber;
                    }
                }
            } else if (violationEntry.nodeEntry.nodeName === permissionType.OBJECT_PERMISSIONS) {
                let objectName: string;
                for (let i = 0; i < violationEntry.nodeEntry.childNodes.length; i += 1) {
                    let childNode = violationEntry.nodeEntry.childNodes[i];
                    if (childNode.nodeName === "object") {
                      objectName = childNode.firstChild;
                    }
                }
                // console.log('Object Name: '+objectName);
                for (let i = 0; i < violationEntry.nodeEntry.childNodes.length; i += 1) {
                    let childNode = violationEntry.nodeEntry.childNodes[i];
                    //console.log('Child Node: '+ childNode);
                    // console.log('Info: '+childNode.firstChild);
                    if((childNode.nodeName === "allowDelete" || childNode.nodeName === "modifyAllRecords" || childNode.nodeName === "viewAllRecords") && childNode.firstChild == 'true') {
                        // console.log('Violtion INFO: '+objectName+'=>'+childNode.nodeName);
                        violationEntry.violationName = objectName+'=>'+childNode.nodeName;
                        violationEntry.violationType = permissionType.OBJECT_PERMISSIONS;
                        violationEntry.violationLineNo = childNode.lineNumber;
                    }
                }
            } else if (violationEntry.nodeEntry.nodeName === permissionType.GROUP_PERMISSIONS) {
                // console.log("***********Group Pemission Violated**********");
                // console.log("Line Number: " + node.lineNumber);
                for (let i = 0; i < violationEntry.nodeEntry.childNodes.length; i += 1) {
                    let childNode = violationEntry.nodeEntry.childNodes[i];
                    if (childNode.nodeName === "doesIncludeBosses") {
                        violationEntry.violationName = childNode.nodeName;
                        violationEntry.violationType = permissionType.GROUP_PERMISSIONS;
                        violationEntry.violationLineNo = childNode.lineNumber;
                    }
                }
            }
        }
        return violations;
    }
}