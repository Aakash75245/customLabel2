import { Connection } from '@salesforce/core';
import { DoaspasEnvJob } from '../lib/analyze_definition';
import { IFJob } from '../lib/analyze_object_definition';
import JobResultTemplate4 from '../lib/analyze_result_template4';

export default class SysAdmin extends DoaspasEnvJob {

    public static runLocal: boolean = true;

    constructor(conn: Connection, job: IFJob) {
        super(job);
    }

    public async run(): Promise<JobResultTemplate4> {
        console.log ('JOB ID:' + this.ref);

        this.result = new JobResultTemplate4(this);

        try {

            // ### perform the check
            this.result.data.push({Name : 'TESTING1', SAJ_Passed__c : true});

        } catch (e) {
            this.result.summary.message = (e as Error).message;
        }
        // ### Store the results on App Central
        await this.result.Process();
        console.log('process done');

        return this.result;
    }

}
