import { DoaspasBuildJob, DoaspasBuildResult, DoaspasShared } from './analyze_definition';
import { IFProcessResult, IFQuery, IFSAJ_Analyze_Result__c } from './analyze_object_definition';
import { fnBuildSoql, fnGetAllId, fnResultMessage } from './analyze_util';
import {  isUndefined, isNullOrUndefined } from 'util';

export default class JobResultTemplate2 extends DoaspasBuildResult {
    public data: IFSAJ_Analyze_Result__c[];

    constructor(job: DoaspasBuildJob) {
        super(job);
        this.data = new Array<IFSAJ_Analyze_Result__c>();
        this.recordtypeid = DoaspasShared.mapRecordType.get('Job_Result_2');
    }

    public async Insert(): Promise<IFProcessResult> {
        const r: IFProcessResult = {passed : true}; 
        const insertChunkJob = new Array();
        //let statusOfInsertedRecord: (import("jsforce").SuccessResult | import("jsforce").ErrorResult | import("jsforce").RecordResult[])[];       

        //prepare chunks if more than 200 records
        if(this.data.length>200){
            let dataToBeInserted: IFSAJ_Analyze_Result__c[] = await this.splitIntoChunks(this.data,199);
            for(let i=0;i<dataToBeInserted.length;i++)
            {
                insertChunkJob.push(DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', dataToBeInserted[i]));
                /* const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', dataToBeInserted[i]);
                 for (const f of this.data) {
                    r.passed = r.passed && f.SAJ_Passed__c;
                }
                r.message = fnResultMessage(p);  */
                r.message='';
                
            }
            await Promise.all(insertChunkJob);
            r.message = ''
        }else{
            const p = await DoaspasShared.acCon.insert('SAJ_Analyze_Result__c', this.data);
                for (const f of this.data) {
                    r.passed = r.passed && f.SAJ_Passed__c;
                }
                r.message = fnResultMessage(p);
        }        
        
        return r;
    }

    public async Replace(): Promise<IFProcessResult> {
        const deleteChunkJob = new Array();
        const q: IFQuery = {conn: DoaspasShared.acCon,
            object: 'SAJ_Analyze_Result__c',
            field: ['Id'],
            where: 'OwnerId = \'' + DoaspasShared.user.Id + '\' AND SAJ_Analyze_Job__c' + '='  + '\'' + this.job.field.JobId + '\'' + ' AND recordtypeid = ' + '\'' + this.recordtypeid + '\''};
        const r = await DoaspasShared.acCon.query<IFSAJ_Analyze_Result__c>(await fnBuildSoql(q));
        //prepare chunks if more than 200 records
        if(r.totalSize>200){

            let dataToBeDeleted: IFSAJ_Analyze_Result__c[] = await this.splitIntoChunks(r.records,199);


            if(!isNullOrUndefined(dataToBeDeleted)){
                for(let i=0;i<dataToBeDeleted.length;i++)
                {                    
                    deleteChunkJob.push(DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', fnGetAllId(<IFSAJ_Analyze_Result__c[]>dataToBeDeleted[i])));                    
                }
                await Promise.all(deleteChunkJob);
            }
            }else{
                await DoaspasShared.acCon.delete('SAJ_Analyze_Result__c', fnGetAllId(r.records));
            }                 

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

    async splitIntoChunks(dataToBeChunked: string | any[], chunk_size: number){
        var index = 0;
        var arrayLength = dataToBeChunked.length;
        var tempArray: IFSAJ_Analyze_Result__c[] = [];
        let myChunk: IFSAJ_Analyze_Result__c;        
        try{
            for (index = 0; index < arrayLength; index += chunk_size) {
                myChunk = <IFSAJ_Analyze_Result__c>dataToBeChunked.slice(index, index+chunk_size);            
                // Do something if you want with the group
                if(!isUndefined(myChunk)){
                    tempArray.push(myChunk);
                }            
            }
        }
        catch(error){
            console.log(error);
        }
    
        return tempArray;
    }
}
