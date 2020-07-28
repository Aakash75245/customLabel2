import { readXml } from "./analyze_util";
import { IFViolation} from "./analyze_object_definition";
import { DoaspasShared } from "./analyze_definition"

// tslint:disable-next-line:no-var-requires
const dom = require("xmldom").DOMParser;
// tslint:disable-next-line:no-var-requires
const xpath = require("xpath");

class DoaspasXPathShared {

  constructor() {
  }

  public async Init(): Promise<void> {
  }

  public async checkAttribute(): Promise<string> {
    let r: string;
    r = "Attribute";
    return r;
  }

  public async checkElementCount(): Promise<number> {
    let r: number;
    r = 10;
    return r;
  }

  /**
   * Returns node list based on the xpath provided
   * @param xpathQuery XPath expression
   * @param xmlStr XML to search
   */
  private async findNodesFromXPath(xpathQuery: string, xmlStr: string): Promise<any> {
    const xmlNoNS = xmlStr.replace(
      ' xmlns="http://soap.sforce.com/2006/04/metadata"',
      ""
    );
    const doc = new dom().parseFromString(xmlNoNS, "text/xml");
    const nodes = xpath.select(xpathQuery, doc);
    return nodes;
  }

  /**
   * Read Local File data
   * 
   */
  private async getFileDataFromPath(fullName: string): Promise<string> {
    let fileData: string = "";
    for (const localFile of DoaspasShared.localFiles) {
      if (localFile.compName === fullName) {
        if (localFile.fileData == undefined || localFile.isDataLoaded === false) {
          localFile.fileData = await readXml(localFile.fullPath);
          localFile.isDataLoaded = true;
        }
        fileData = localFile.fileData;
      }
    }
    return fileData;
  }

  /**
    *  Returns violation list with line numbers in json.
    * @param permissions arrary of permissions to monitor
    * @returns array of violdations & nodes.
    */


   public async findViolationsAtXPath(xpathExp: string,fileName: string): Promise<Array<IFViolation>> {
    const violations: IFViolation[] = new Array();
    let xmlStr: string = await this.getFileDataFromPath(fileName);
    let nodes = await this.findNodesFromXPath(xpathExp, xmlStr);
    for (const node of nodes) {
      let violation : IFViolation = {
        violationName:'', 
        violationFile:fileName, 
        violationType:'', 
        violationLineNo:0, 
        nodeEntry:node, 
        isXPathValid: true,
        xPathExp: xpathExp,
        xPathError: undefined};
      violations.push(violation);
    }
    return violations;
  }
}
export { DoaspasXPathShared };