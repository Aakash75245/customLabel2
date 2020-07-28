import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import { DoaspasShared } from '../../lib/analyze_definition';
import { jobmap } from '../../lib/analyze_job_mapping';
import { IFJob, IFSAJ_Analyze_Job_Assignment__c, IFSummary } from '../../lib/analyze_object_definition';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('doaspas', 'org');

export default class Analyze extends SfdxCommand {

  public static description = messages.getMessage('commandDescription');

  public static examples = [
  '$ sfdx build:analyze -u AppCentralOrg -n -t ValidationOrg "Build A" '
  ];

  public static args = [{name: 'file'}];

  protected static flagsConfig = {
    // flag with a value (-n, --name=VALUE)
    targetorg: flags.string({char: 't', description: messages.getMessage('nameFlagDescription')}),
    buildenvid: flags.string({char: 'b', description: messages.getMessage('nameFlagDescription')}),
    name: flags.string({char: 'n', description: messages.getMessage('nameFlagDescription')}),
    force: flags.boolean({char: 'f', description: messages.getMessage('forceFlagDescription')})
  };



  public async run(): Promise<AnyJson> {

   console.log('Hiiiiiiiiiii');



const myMessages:JSON = <JSON><unknown>{
    "Severity": '5',
    "Reason For Failure": 'Dont have Prefix - ',
    "DevPrefix":"DEV",
    "AllowedPrefix":"CTT,REX"
  }


console.log(myMessages);
   return '';
  }
}
