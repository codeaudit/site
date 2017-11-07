import React, { Component } from 'react';
import Web3 from 'web3'; // TODO: follow up on how to use web3 when pulled in vs metamask
import StakeTreeWithTokenization from 'staketree-contracts/build/contracts/StakeTreeWithTokenization.json';

// Styling
import './ContractInterface.css';

//Components
import FundButton from './FundButton.js';
import EtherscanLink from './EtherscanLink.js';
import FunderCard from './FunderCard.js';
import BeneficiaryCard from './BeneficiaryCard.js';

let contractInstanceWeb3;
let web3Polling;
const web3 = new Web3();

class ContractInterface extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      exchangeRate: 0,
      currentEthAccount: "",
      showTooltip: "",
      isFunder: false,
      isBeneficiary: false,
      customAmount: 0.1,
      web3available: true,
      contractAddress: this.props.match.params.address,
      contract: {
        totalCurrentFunders: 0,
        balance: 0,
        startTime: "...",
        nextWithdrawal: "...",
        withdrawalPeriod: "...",
        live: true,
        sunsetPeriod: "...",
        minimumFundingAmount: 0
      },
      funder: {
        balance: 0,
        contribution: 0,
        contributionClaimed: 0
      },
      contractInstance: '',
      loading: true,
      user: { // Fetch this information in the future
        title: 'StakeTree Development Fund',
      }
    };
  }

  async componentWillMount() {

    fetch("https://api.coinmarketcap.com/v1/ticker/ethereum/?convert=USD")
      .then(res => {return res.json()})
      .then(data => {
        this.setState({
          exchangeRate: parseInt(data[0].price_usd, 10)
        });
      });

    let pollingCounter = 0;
    // Poll for account/web3 changes
    web3Polling = setInterval(async ()=> {
      if(typeof window.web3 !== 'undefined') {
        this.setState({"web3available": true});

        // dirty hack for web3@1.0.0 support for localhost testrpc, 
        // see https://github.com/trufflesuite/truffle-contract/issues/56#issuecomment-331084530
        if (typeof window.web3.currentProvider.sendAsync !== "function") {
          window.web3.currentProvider.sendAsync = function() {
            return window.web3.currentProvider.send.apply(
              window.web3.currentProvider,
                  arguments
            );
          };
        }

        const contractWeb3 = window.web3.eth.contract(StakeTreeWithTokenization.abi);
        contractInstanceWeb3 = contractWeb3.at(this.state.contractAddress);
        window.contractInstanceWeb3 = contractInstanceWeb3; // debugging

        // Determine is this is the right contract
        contractInstanceWeb3.version.call({}, (err, result)=>{
          if(result && result.c && result.c[0] && result.c[0] === 2) {
            this.setState({contractInstance: contractInstanceWeb3});
            this.setState({loading: false});
          }
          else {
            // No contract found
            this.setState({loading: false});
          }
        });

        if(contractInstanceWeb3) {
          contractInstanceWeb3.totalCurrentFunders.call({}, (err, result) => {
            this.setContractState('totalCurrentFunders', result.toNumber());
          });
          contractInstanceWeb3.getContractBalance.call({}, (err, result) => {
            this.setContractState('balance', result.toNumber());
          });
          contractInstanceWeb3.contractStartTime.call({}, (err, result) => {
            this.setContractState('contractStartTime', result.toNumber());
          });
          contractInstanceWeb3.nextWithdrawal.call({}, (err, result)=>{
            this.setContractState('nextWithdrawal', result.toNumber());
          });
          contractInstanceWeb3.withdrawalPeriod.call({}, (err, result)=>{
            this.setContractState('withdrawalPeriod', result.toNumber());
          });
          contractInstanceWeb3.live.call({}, (err, result)=>{
            this.setContractState('live', result);
          });
          contractInstanceWeb3.sunsetWithdrawalPeriod.call({}, (err, result)=>{
            this.setContractState('sunsetWithdrawalPeriod', result.toNumber());
          });
          contractInstanceWeb3.minimumFundingAmount.call({}, (err, result)=>{
            this.setContractState('minimumFundingAmount', result.toNumber());
          });
          contractInstanceWeb3.tokenized.call({}, (err, result)=>{
            this.setContractState('tokenized', result);
          });

          contractInstanceWeb3.withdrawalCounter.call({}, (err, result)=>{
            this.setContractState('withdrawalCounter', result.toNumber());
          });

          window.web3.eth.getAccounts(async (error, accounts) => {
            if(this.state.currentEthAccount !== accounts[0]){
              // RESET UI
              this.setState({
                currentEthAccount: accounts[0],
                isFunder: false,
                isBeneficiary: false
              });
            }

            // Check again for new accounts
            contractInstanceWeb3.isFunder(this.state.currentEthAccount, (err, isFunder) => {
              if(isFunder) {
                contractInstanceWeb3.getFunderBalance.call(this.state.currentEthAccount, (err, result)=>{
                  this.setState({
                    ...this.state,
                    funder: {
                      ...this.state.funder,
                      balance: result.toNumber()
                    }
                  });
                });
                contractInstanceWeb3.getFunderContribution.call(this.state.currentEthAccount, (err, result)=>{
                  this.setState({
                    ...this.state,
                    funder: {
                      ...this.state.funder,
                      contribution: result.toNumber()
                    }
                  });
                });
                contractInstanceWeb3.getFunderContributionClaimed.call(this.state.currentEthAccount, (err, result)=>{
                  this.setState({
                    ...this.state,
                    funder: {
                      ...this.state.funder,
                      contributionClaimed: result.toNumber()
                    }
                  });
                });
              }

              this.setState({
                ...this.state,
                isFunder: isFunder,
              });
            });

            contractInstanceWeb3.beneficiary.call({}, (err, beneficiary) => {
              this.setState({
                ...this.state,
                isBeneficiary: this.state.currentEthAccount === beneficiary
              });
              this.setContractState('beneficiary', beneficiary);
            });
          });
        }
      }
      else {
        pollingCounter++;
        if(pollingCounter === 3) {
          this.setState({loading: false, web3available: false});
        }
      }
    }, 1500);
  }

  componentWillUnmount() {
    clearInterval(web3Polling);
  }

  setContractState(key, value) {
    const newContractState = {
        ...this.state.contract
    };
    newContractState[key] = value;

    this.setState({
      contract: newContractState
    });
  }

  handleCustomAmount(e) {
    let value = e.target.value;
    if(e.target.value === "") value = 0.1;
    this.setState({customAmount: value});
  }

  noWeb3() {
    if(!this.state.web3available) {
      return <div className="no-web3"><p>To fund StakeTree using the buttons below you need have <a href="https://metamask.io" target="_blank" rel="noopener noreferrer">MetaMask</a> installed. If you have MetaMask installed, try unlocking it before trying again. Otherwise send ether to this address, <code>{this.state.contractAddress}</code>, using your preffered wallet.</p></div>;
    }
    return "";
  }


  render() {

    const customAmount = this.state.customAmount > 0 ? this.state.customAmount : 0.1;

    const fundStarted = new Date(this.state.contract.contractStartTime*1000).toLocaleDateString();
    const nextWithdrawal = new Date(this.state.contract.nextWithdrawal*1000).toLocaleDateString();
    const sunsetPeriodDays = Math.floor((this.state.contract.sunsetWithdrawalPeriod % 31536000) / 86400);
    const withdrawalPeriodDays = Math.floor((this.state.contract.withdrawalPeriod % 31536000) / 86400);

    const balance = web3.utils.fromWei(this.state.contract.balance, 'ether');
    
    let withdrawalAmount = this.state.exchangeRate * (balance * 0.1);
    withdrawalAmount = withdrawalAmount.toFixed(2);

    let totalStakedDollar = this.state.exchangeRate * (balance);
    totalStakedDollar = totalStakedDollar.toFixed(2);

    const minAmount = web3.utils.fromWei(this.state.contract.minimumFundingAmount, 'ether');

    const noContractHtml = this.state.web3available && this.state.contractInstance === '' ? <div className="six columns offset-by-three">
                <div className="contract-card">
                  <p>No staketree contract found at this address. Double check that you have the correct address.</p>
                </div>
              </div> : <span></span>;
    
    const noWeb3 = !this.state.web3available ? <div className="six columns offset-by-three">
                <div className="contract-card">
                  <p>It doesn't seem like you have <a href="https://metamask.io" target="_blank" rel="noopener noreferrer">MetaMask</a> installed. Try installing it and refreshing this page.</p>
                </div>
              </div> : <span></span>;

    return (
      <div className="container">
        <div className="row">
          {this.state.loading ? 
            <div className="twelve columns">
              Loading...
            </div> 
          : 
            <span>
            {noWeb3}
            {noContractHtml}
            {this.state.contractInstance ? 
              <span>
              <div className="five columns">
                {this.state.isFunder ? <FunderCard 
                  toAddress={this.state.contractAddress}
                  minAmount={minAmount}
                  funder={this.state.funder} 
                  contract={this.state.contractInstance} 
                  tokenized={this.state.contract.tokenized} /> : ''}
                {this.state.isBeneficiary ? <BeneficiaryCard 
                  nextWithdrawal={this.state.contract.nextWithdrawal}
                  withdrawalCounter={this.state.contract.withdrawalCounter}
                  totalStakedDollar={totalStakedDollar} 
                  contract={this.state.contractInstance} /> : ''}
                {!this.state.isBeneficiary && !this.state.isFunder ? <div className='contract-card'>
                Are you a beneficiary or funder? Select your respective account in Metamask to interact with this contract.
                </div> : ''}
              </div>

              <div className="seven columns">
                <div className="contract-card">
                  <h4>Contract details</h4>
                  <ul>
                    <li>Total staked: {balance} ether</li>
                    <li>Total funders: {this.state.contract.totalCurrentFunders}</li>
                    <li>Next Withdrawal Amount: ±${withdrawalAmount}</li>
                    <li>Withdrawal Period: {withdrawalPeriodDays} days</li>
                    <li>Next Withdrawal: {nextWithdrawal}</li>
                    <li>Fund Started: {fundStarted}</li>
                    <li>Sunset Period: {sunsetPeriodDays} days</li>
                    <li>Live: {this.state.contract.live ? '✔' : '🚫'}</li>
                    <li>Beneficiary: <code><EtherscanLink type={"address"} text={this.state.contract.beneficiary} id={this.state.contract.beneficiary} /></code></li>
                    <li>Contract: <code><EtherscanLink type={"address"} text={this.props.match.params.address} id={this.props.match.params.address} /></code></li>
                  </ul>
                  <div className="contract-card-actions">
                    <div className="main-actions">
                      <FundButton toAddress={this.state.contractAddress} amount={customAmount} minAmount={minAmount} >Stake {customAmount} Ether</FundButton>
                      <input step="0.1" placeholder="Custom amount?" className="custom-value-input" type="number" onChange={this.handleCustomAmount.bind(this)} />
                    </div>
                  </div>
                </div>              
              </div></span> : ''}              
            </span>
          }
        </div>
      </div>
    );
  }
}

export default ContractInterface;