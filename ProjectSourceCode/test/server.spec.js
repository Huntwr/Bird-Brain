// ********************** Initialize server **********************************
const server = require('../server.js'); // Adjust path if your main file name differs

// ********************** Import Libraries ***********************************
const chai = require('chai');
const chaiHttp = require('chai-http');
chai.should();
chai.use(chaiHttp);
const { assert, expect } = chai;

// ********************** DEFAULT WELCOME TESTCASE ****************************
describe('Server!', () => {
  it('Returns the default welcome message', done => {
    chai
      .request(server)
      .get('/welcome')
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body.status).to.equals('success');
        assert.strictEqual(res.body.message, 'Welcome!');
        done();
      });
  });
});

// ********************** REGISTER API TEST CASES ****************************
describe('Register API', () => {

  // Positive Test Case
  it('Positive: should register a valid user successfully', done => {
    chai
      .request(server)
      .post('/register')
      .send({
        username: 'testuser',
        password: 'validpassword123'
      })
      .end((err, res) => {
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('object');
        expect(res.body.message).to.equals('Success');
        done();
      });
  });

  // Negative Test Case
  it('Negative: should fail to register with invalid input', done => {
    chai
      .request(server)
      .post('/register')
      .send({
        username: '',
        password: ''
      })
      .end((err, res) => {
        expect(res).to.have.status(400);
        expect(res.body).to.be.an('object');
        expect(res.body.message).to.equals('Invalid input');
        done();
      });
  });
});
