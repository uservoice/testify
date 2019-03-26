import { SinonStatic } from "sinon";

declare const sinon: SinonStatic;

interface ITestifyApi {
  chai: Chai.ChaiStatic;
  addAlias(alias: string, actualPath: string): void;
}