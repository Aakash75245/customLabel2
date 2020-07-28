import { DoaspasEnvJob, DoaspasBuildResult, DoaspasShared, DoaspasEnvironmentResult } from './analyze_definition';
import { IFProcessResult, IFQuery, IFSAJ_Analyze_Result__c } from './analyze_object_definition';
import { fnBuildSoql, fnGetAllId, fnResultMessage, fnDelete } from './analyze_util';
import { util } from 'chai';

export default class JobResultTemplate4 extends DoaspasEnvironmentResult {
    public data: IFSAJ_Analyze_Result__c[];

    constructor(job: DoaspasEnvJob) {
        super(job);
        this.data = new Array<IFSAJ_Analyze_Result__c>();
        this.recordtypeid = DoaspasShared.mapRecordType.get('Job_Result_4');
    }

    public async Insert(): Promise<IFProcessResult> {
        const r: IFProcessResult = {passed : true};
        const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', this.data);

        for (const f of this.data) {
            r.passed = r.passed && f.SAJ_Passed__c;
        }
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
        const r: IFProcessResult = {passed : true};
        const p = await DoaspasShared.acCon.upsert('SAJ_Analyze_Result__c', this.data, 'Id');
        for (const f of this.data) {
            r.passed = r.passed && f.SAJ_Passed__c;
        }
        r.message = fnResultMessage(p);
        return r;
    }

    public toJSON() {
        const ret = [{summary: this.summary, data: this.data}];
        return ret;
    }

    protected setCommonFields(): void {
        for (const f of this.data) {
            this.setFields(f);
        }
    }
}
