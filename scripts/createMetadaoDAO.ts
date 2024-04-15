import * as anchor from '@coral-xyz/anchor'
import { IDL } from './metadao/idl'
import {
  AUTOCRAT_PROGRAM_ID,
  DRIFT_GOVERNANCE_TOKEN_MINT,
  USDC_MINT,
  VENTURE_DAO_KEY,
} from '../constants'

const script = async () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = new anchor.Program(IDL, AUTOCRAT_PROGRAM_ID, provider)

  // Now you can use `dao` in your `initializeDao` method
  const txid = await program.methods
    .initializeDao()
    .accountsStrict({
      payer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      dao: VENTURE_DAO_KEY.publicKey,
      usdcMint: USDC_MINT,
      metaMint: DRIFT_GOVERNANCE_TOKEN_MINT,
    })
    .signers([VENTURE_DAO_KEY])
    .rpc()
  console.log('Transaction ID: ', txid)
  const result = await provider.connection.confirmTransaction(txid, 'finalized')
  console.log('Confirmation: ', result)
}
script()
