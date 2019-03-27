export class TestClass {
  createDom() {
    const div = document.createElement('div');
    div.id = 'test-div';
    div.setAttribute('href', '#');
    document.body.appendChild(div);
  }
}