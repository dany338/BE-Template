const express = require('express');
const bodyParser = require('body-parser');
const {sequelize} = require('./model')
const {getProfile} = require('./middleware/getProfile')
const { Op } = require("sequelize")
const app = express();
app.use(bodyParser.json());
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id',getProfile ,async (req, res) => {
    const {Contract} = req.app.get('models')
    const {id} = req.params
    const contract = await Contract.findByPk(id)
    if(!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/contracts',getProfile ,async (req, res) => {
    const {Contract} = req.app.get('models')
    const contract = await Contract.findAll()
    if(!contract) return res.status(404).end()
    res.json(contract)
})

app.get('/jobs/unpaid',getProfile ,async (req, res) => {
    const {Contract, Job} = req.app.get('models')
    const contract = await Contract.findAll({where: {ClientId: req.get('profile_id') || 0, status: 'in_progress'}, include: {model: Job, where: {paid: {[Op.is]: null}}}})
    if(!contract) return res.status(404).end()
    res.json(contract)
})

app.post('/jobs/:job_id/pay',getProfile ,async (req, res) => {
    const profileClient = req.profile
    const { Profile, Job } = req.app.get('models')
    const { contractorId } = req.body
    const { job_id } = req.params
    const jobContract = await Job.findByPk(job_id)
    if(profileClient.balance > jobContract.price && jobContract.paid === null && profileClient.type === 'client') {
      const profileClientBalance = await Profile.update({balance: profileClient.balance - jobContract.price}, {where: {id: profileClient.id}})
      if (profileClientBalance) {
        const profileContractorBalance = await Profile.findOne({where: {id: contractorId, type: 'contractor'}})
        if(profileContractorBalance) {
          const jobContractUpdate = await Job.update({paid: true}, {where: {id: jobContract.id}})
          const profileContractorBalanceUpdate = await Profile.update({balance: profileContractorBalance.balance + jobContract.price}, {where: {id: profileContractorBalance.id}})
          return profileContractorBalanceUpdate ? res.json({success: true, message: profileContractorBalanceUpdate, paid: jobContractUpdate}) : res.status(500).end();
        }
        return res.json({success: false, message: 'Contractor not found'})
      }
      return res.json({success: false, message: 'The client has not update ypur balance'})
    }
  return res.json({success: false, message: 'The client not have enough money or the job is paid'})
})

app.get('/jobs/:id',getProfile ,async (req, res) =>{
    const {Job} = req.app.get('models')
    const {id} = req.params
    const job = await Job.findByPk(id)
    if(!job) return res.status(404).end()
    res.json(job)
})

app.get('/profiles/:id',getProfile ,async (req, res) =>{
    const {Profile, Contract, Job} = req.app.get('models')
    const {id} = req.params
    const profile = await Profile.findAll({where: {id}, include: {model: Contract, as: 'Client', include: {model: Job}} })
    if(!profile) return res.status(404).end()
    res.json(profile)
})

app.post('/balances/deposit/:userId',getProfile ,async (req, res) => {
  const profileClient = req.profile
  const {Profile, Contract, Job} = req.app.get('models')
  const { balance } = req.body
  const profileJobsWithoutPay = await Profile.findAll({where: {id: req.get('profile_id')}, include: {model: Contract, as: 'Client', include: {model: Job, where: {paid: {[Op.is]: null}}}} })
  if (profileJobsWithoutPay && profileClient.type === 'client') {
    const profileJobsWithoutPayPrice = profileJobsWithoutPay.reduce((acc, cur) => {
      return acc + cur.Client.reduce((acc, cur) => acc + cur.Jobs.reduce((acc, cur) => acc + cur.price, 0), 0)
    }, 0)
    const percent = Math.ceil((+balance * 100) / +profileJobsWithoutPayPrice)
    if( percent <= 25) {
      const profileClientUpdate = await Profile.update({balance: profileClient.balance + balance}, {where: {id: profileClient.id}})
      return profileClientUpdate ? res.json({success: true, message: profileClientUpdate}) : res.status(500).end();
    }
    res.json({success: false, message: percent})
  } else {
    res.json({success: false, message: 'The client has not jobs without pay'})
  }
})

app.get('/admin/bestprofession/:start/:end',getProfile ,async (req, res) => {
  const {Profile, Contract, Job} = req.app.get('models')
  const { start, end } = req.params
  const profileJobsWithoutPay = await Profile.findAll({where: {id: req.get('profile_id')}, include: {model: Contract, as: 'Client', include: {model: Job, where: {paid: true}}} })
  res.json({success: false, message: { start, end } })
})
module.exports = app;
