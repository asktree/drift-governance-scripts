import { Keypair, PublicKey } from '@solana/web3.js'
import ventureKeypair from './vanity-keypairs/dfutifdyDWKufgbo2yEXjoeZymPWgA1khQMKr1zTsxB.json'

// GENERAL
export const DRIFT_PROGRAM_ID = new PublicKey(
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'
)

export const DRIFT_GOVERNANCE_TOKEN_MINT = new PublicKey(
  '8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2'
)

export const USDC_MINT = new PublicKey(
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
)

// REALMS
export const GOV_PROGRAM_ID = new PublicKey(
  'dgov7NC8iaumWw3k8TkmLDybvZBCmd1qwxgLAGAsWxf'
)
export const PLUGIN_PROGRAM_ID = new PublicKey(
  'dVoTE1AJqkZVoE1mPbWcqYPmEEvAUBksHY2NiM2UJQe'
)

// METADAO
export const AUTOCRAT_PROGRAM_ID = new PublicKey(
  'metaRK9dUBnrAdZN6uUDKvxBVKW5pyCbPVmLtUZwtBp'
)
export const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  'vAuLTQjV5AZx5f3UgE75wcnkxnQowWxThn1hGjfCVwP'
)
export const OPENBOOK_TWAP_PROGRAM_ID = new PublicKey(
  'twAP5sArq2vDS1mZCT7f4qRLwzTfHvf5Ay5R5Q5df1m'
)
export const OPENBOOK_PROGRAM_ID = new PublicKey(
  'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb'
)

// this is used to initialize the DAO, and never again after.
export const VENTURE_DAO_KEY = Keypair.fromSecretKey(
  Uint8Array.from(ventureKeypair)
)
