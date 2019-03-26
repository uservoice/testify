import { TestClass } from './fixtures';
import * as sinon from 'sinon';
import { expect } from 'chai';

describe('testify', () => {
  it('can import .ts files, mock w/sinon and test the dom', () => {
    const instance = new TestClass();
    sinon.spy(instance, 'createDom');
    instance.createDom();
    const testDiv = document.body.querySelector('#test-div');
    expect(instance.createDom).called;
    expect(testDiv).to.exist;
    expect(testDiv).attr('href', '#');
  });
});
