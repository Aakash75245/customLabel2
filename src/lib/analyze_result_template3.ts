import { DoaspasEnvJob, DoaspasEnvironmentResult, DoaspasShared } from './analyze_definition';
import { IFProcessResult, IFQuery, IFSAJ_Analyze_Result__c } from './analyze_object_definition';
import { fnBuildSoql, fnGetAllId, fnResultMessage, fnDelete } from './analyze_util';

export default class JobResultTemplate3 extends DoaspasEnvironmentResult {
    public data: IFSAJ_Analyze_Result__c;

    constructor(job: DoaspasEnvJob) {
        super(job);
        this.data = {SAJ_Passed__c : false};
        this.recordtypeid = DoaspasShared.mapRecordType.get('Job_Result_3');
    }

    public async Insert(): Promise<IFProcessResult> {
        const r: IFProcessResult = {};
        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', this.data);
        r.passed = this.data.SAJ_Passed__c;
        r.message = fnResultMessage(p);
        return r;
    }

    public async Replace(): Promise<IFProcessResult> {

        const q: IFQuery = {conn: DoaspasShared.acCon,
                            object: 'SAJ_Analyze_Result__c',
                            field: ['Id'],
                            where: 'OwnerId = \'' + DoaspasShared.user.Id + '\' AND SAJ_Analyze_Job__c' + '='  + '\'' + this.job.field.JobId + '\'' + ' AND recordtypeid = ' + '\'' + this.recordtypeid + '\'' + ' AND SAJ_Environment__c = \'' + DoaspasShared.environment.Id + '\''};
        const r = await DoaspasShared.acCon.query<IFSAJ_Analyze_Result__c>(await fnBuildSoql(q));
        await fnDelete(fnGetAllId(r.records));
        return await this.Insert();
    }

    public async Upsert(): Promise<IFProcessResult> {
        const r: IFProcessResult = {};
        const p = await DoaspasShared.acCon.upsert('SAJ_Analyze_Result__c', this.data, 'Id');
        r.passed = this.data.SAJ_Passed__c;
        r.message = fnResultMessage(p);
        return r;
    }

    public toJSON() {
        const ret = [{summary: this.summary, data: this.data}];
        return ret;
    }

    protected setCommonFields(): void {
        this.setFields(this.data);
    }
}
