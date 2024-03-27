import {
  GovernanceConfig,
  GoverningTokenConfigAccountArgs,
  GoverningTokenType,
  MintMaxVoteWeightSource,
  MintMaxVoteWeightSourceType,
  SetRealmAuthorityAction,
  TOKEN_PROGRAM_ID,
  VoteThreshold,
  VoteThresholdType,
  VoteTipping,
  withCreateGovernance,
  withCreateNativeTreasury,
  withCreateRealm,
  withCreateTokenOwnerRecord,
  withDepositGoverningTokens,
  withSetRealmAuthority,
} from '@solana/spl-governance'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'

import { BN, Program } from '@coral-xyz/anchor'

import keypair from '../keypair.json'
import {
  AuthorityType,
  MintLayout,
  createInitializeMintInstruction,
  createSetAuthorityInstruction,
  getMint,
} from '@solana/spl-token'
import { IDL } from './realms-plugin-sdk/idl'

const wallet = Keypair.fromSecretKey(Uint8Array.from(keypair))

const GOV_PROGRAM_ID = new PublicKey(
  'dgov7NC8iaumWw3k8TkmLDybvZBCmd1qwxgLAGAsWxf'
)
const DRIFT_PROGRAM_ID = new PublicKey(
  'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH'
)
const PLUGIN_PROGRAM_ID = new PublicKey(
  'dVoTE1AJqkZVoE1mPbWcqYPmEEvAUBksHY2NiM2UJQe'
)
const REALM_NAME = 'Drift DAO Devnet' // "Drift DAO"
// Token Configuration ----------------------------------------------------------
const DRIFT_GOVERNANCE_TOKEN_MINT = new PublicKey(
  '8zGuJQqwhZafTah7Uc7Z4tXRnguqkn5KLFAP8oV6PHe2'
) // TODO
const DRIFT_GOV_TOKEN_SPOT_INDEX = 0 // TODO
const CIRCULATING_TOKEN_SUPPLY = new BN(1000000000000) // in raw form (to the power of 10^mintInfo.decimals)

// DAO Configuration -------------------------------------------------------------
// We aren't really expecting to create any DAO wallets after the DAO genesis. Creating them maliciously doesn't do anything, though it can be used to grief the UI.
const minTokensToCreateDaoWallet = CIRCULATING_TOKEN_SUPPLY.divn(2)
// List council members for the veto council
const councilMembers = [wallet.publicKey]

// -- Voting rules
const communityVoteQuorumPercent = 2 // 2%
const councilVetoPercent = 30 // 30%
const minCommunityTokensToCreateProposal = new BN(20000) // 20k, in human-readable form (not raw)

// The amount of time a proposal can be voted on normally
const votingPeriodHours = 24 * 6
// During the cooldown period, you can only withdraw votes, vote No, or veto
const cooldownPeriodHours = 24 * 4
// If a proposal does pass, it has to wait this long before it can actually execute
const holdupPeriodHours = 24 * 4

const script = async () => {
  console.log('Bing bong! Beginning script.')
  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 2000,
  })

  if (!process.env.RPC) {
    throw new Error('RPC env var not set')
  }
  const connection = new Connection(process.env.RPC as string)
  const councilMint = Keypair.generate()

  const mintInfo = await getMint(connection, DRIFT_GOVERNANCE_TOKEN_MINT)

  const sendInstructions = async (
    instructions: TransactionInstruction[],
    label: string,
    signers: Keypair[] = []
  ) => {
    const tx = new Transaction().add(...instructions)
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    tx.sign(wallet, ...signers)
    const a = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
    })
    console.log(label, ': send tx: ', a)
    console.log(label, ': waiting for confirmation...')
    const b = await connection.confirmTransaction(a)
    const success = b.value.err === null
    console.log(
      label,
      'confirmation: ',
      b.value.err ? `Error: ${b.value.err}` : `Success!`
    )
    return success
  }

  // -- Initialize council membership token
  const mintRentExempt = await connection.getMinimumBalanceForRentExemption(
    MintLayout.span
  )
  const councilMintIxs = [
    SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: councilMint.publicKey,
      lamports: mintRentExempt,
      space: MintLayout.span,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(
      councilMint.publicKey,
      0,
      wallet.publicKey,
      null
    ),
  ]
  console.log('Creating council mint...')
  console.log('Council mint PK', councilMint.publicKey.toBase58())
  const t0 = await sendInstructions(councilMintIxs, 'Council mint', [
    councilMint,
  ])
  if (!t0) return

  // CREATE REALM
  console.log('Creating realm...')
  const createRealmIxs: TransactionInstruction[] = []
  const realmPk = await withCreateRealm(
    createRealmIxs,
    GOV_PROGRAM_ID,
    3,
    REALM_NAME,
    wallet.publicKey,
    DRIFT_GOVERNANCE_TOKEN_MINT,
    wallet.publicKey,
    councilMint.publicKey,
    new MintMaxVoteWeightSource({
      type: MintMaxVoteWeightSourceType.Absolute,
      value: CIRCULATING_TOKEN_SUPPLY,
    }),
    minTokensToCreateDaoWallet,
    // community token config
    new GoverningTokenConfigAccountArgs({
      tokenType: GoverningTokenType.Liquid,
      voterWeightAddin: PLUGIN_PROGRAM_ID,
      maxVoterWeightAddin: undefined,
    }),
    // council token config
    new GoverningTokenConfigAccountArgs({
      tokenType: GoverningTokenType.Membership,
      voterWeightAddin: undefined,
      maxVoterWeightAddin: undefined,
    })
  )
  console.log('Realm PK', realmPk.toBase58())
  const t1 = await sendInstructions(createRealmIxs, 'Realm creation')
  if (!t1) return

  // CREATE PRIMARY WALLET
  const createPrimaryWalletIxs: TransactionInstruction[] = []
  const primaryGovernancePk = await withCreateGovernance(
    createPrimaryWalletIxs,
    GOV_PROGRAM_ID,
    3,
    realmPk,
    undefined,
    new GovernanceConfig({
      communityVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: communityVoteQuorumPercent,
      }),
      minCommunityTokensToCreateProposal:
        minCommunityTokensToCreateProposal.mul(new BN(10 ** mintInfo.decimals)),
      minInstructionHoldUpTime: holdupPeriodHours * 60 * 60,
      baseVotingTime: votingPeriodHours * 60 * 60,
      // Enabling vote tipping for a liquid token makes the DAO vulnerable to flash loan attacks
      communityVoteTipping: VoteTipping.Disabled,
      councilVoteTipping: VoteTipping.Strict,
      minCouncilTokensToCreateProposal: new BN(1),
      // The council cannot directly vote on anything
      councilVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.Disabled,
      }),
      councilVetoVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: councilVetoPercent,
      }),
      // The council can't vote on anything, so the community would have nothing to veto
      communityVetoVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.Disabled,
      }),
      votingCoolOffTime: cooldownPeriodHours * 60 * 60,
      depositExemptProposalCount: 1,
    }),
    PublicKey.default,
    wallet.publicKey,
    wallet.publicKey
  )

  const primaryDaoWalletPk = await withCreateNativeTreasury(
    createPrimaryWalletIxs,
    GOV_PROGRAM_ID,
    3,
    primaryGovernancePk,
    wallet.publicKey
  )
  console.log('Primary governance PK', primaryGovernancePk.toBase58())
  console.log('Primary DAO wallet PK', primaryDaoWalletPk.toBase58())
  const t2 = await sendInstructions(
    createPrimaryWalletIxs,
    'Primary wallet creation'
  )
  if (!t2) return

  // CREATE COUNCIL MEMBERSHIP WALLET
  const createCouncilMembershipWalletIxs: TransactionInstruction[] = []
  const councilMembershipGovernancePk = await withCreateGovernance(
    createCouncilMembershipWalletIxs,
    GOV_PROGRAM_ID,
    3,
    realmPk,
    undefined,
    new GovernanceConfig({
      // This wallet is the same as the primary wallet, except that the council cannot veto proposals in this wallet
      councilVetoVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.Disabled,
      }),
      communityVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.YesVotePercentage,
        value: communityVoteQuorumPercent,
      }),
      minCommunityTokensToCreateProposal:
        minCommunityTokensToCreateProposal.mul(new BN(10 ** mintInfo.decimals)),
      minInstructionHoldUpTime: holdupPeriodHours * 60 * 60,
      baseVotingTime: votingPeriodHours * 60 * 60,
      communityVoteTipping: VoteTipping.Disabled,
      councilVoteTipping: VoteTipping.Strict,
      minCouncilTokensToCreateProposal: new BN(1),
      councilVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.Disabled,
      }),

      communityVetoVoteThreshold: new VoteThreshold({
        type: VoteThresholdType.Disabled,
      }),
      votingCoolOffTime: cooldownPeriodHours * 60 * 60,
      depositExemptProposalCount: 1,
    }),
    PublicKey.default,
    wallet.publicKey,
    wallet.publicKey
  )
  const councilMembershipWalletPk = await withCreateNativeTreasury(
    createCouncilMembershipWalletIxs,
    GOV_PROGRAM_ID,
    3,
    councilMembershipGovernancePk,
    wallet.publicKey
  )
  console.log(
    'Council membership governance PK',
    councilMembershipGovernancePk.toBase58()
  )
  console.log(
    'Council membership wallet PK',
    councilMembershipWalletPk.toBase58()
  )
  const t3 = await sendInstructions(
    createCouncilMembershipWalletIxs,
    'Council membership wallet creation'
  )
  if (!t3) return

  // Create Realms council
  // -- Add members --------------------------------
  const addMembersIxs: TransactionInstruction[] = []
  for (const councilMember of councilMembers) {
    await withCreateTokenOwnerRecord(
      addMembersIxs,
      GOV_PROGRAM_ID,
      3,
      realmPk,
      councilMember,
      councilMint.publicKey,
      wallet.publicKey
    )
    await withDepositGoverningTokens(
      addMembersIxs,
      GOV_PROGRAM_ID,
      3,
      realmPk,
      councilMint.publicKey,
      councilMint.publicKey,
      councilMember,
      wallet.publicKey,
      wallet.publicKey,
      new BN(1),
      false
    )
  }
  // -- Transfer mint to Council Membership Wallet
  const transferCouncilMintIx = createSetAuthorityInstruction(
    councilMint.publicKey,
    wallet.publicKey,
    AuthorityType.MintTokens,
    councilMembershipWalletPk
  )
  const t4 = await sendInstructions(
    [...addMembersIxs, transferCouncilMintIx],
    'Council membership'
  )
  if (!t4) return

  // Create plugin registrar
  const program = new Program(IDL, PLUGIN_PROGRAM_ID, { connection })

  const [registrarPk] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('registrar'),
      realmPk.toBuffer(),
      DRIFT_GOVERNANCE_TOKEN_MINT.toBuffer(),
    ],
    PLUGIN_PROGRAM_ID
  )
  const createRegistrarIx = await program.methods
    .createRegistrar(DRIFT_GOV_TOKEN_SPOT_INDEX)
    .accountsStrict({
      realm: realmPk,
      registrar: registrarPk,
      governingTokenMint: DRIFT_GOVERNANCE_TOKEN_MINT,
      governanceProgramId: GOV_PROGRAM_ID,
      realmAuthority: wallet.publicKey,
      payer: wallet.publicKey,
      systemProgram: SystemProgram.programId,
      driftProgramId: new PublicKey(DRIFT_PROGRAM_ID),
    })
    .instruction()
  console.log('Registrar PK', registrarPk.toBase58())
  const t5 = await sendInstructions([createRegistrarIx], 'Registrar creation')
  if (!t5) return

  // Set Realm authority to Primary Wallet
  const transferRealmAuthorityIxs: TransactionInstruction[] = []
  withSetRealmAuthority(
    transferRealmAuthorityIxs,
    GOV_PROGRAM_ID,
    3,
    realmPk,
    wallet.publicKey,
    primaryGovernancePk,
    SetRealmAuthorityAction.SetChecked
  )
  const t6 = await sendInstructions(
    transferRealmAuthorityIxs,
    'Realm authority transfer'
  )
  if (!t6) return
}

script()
