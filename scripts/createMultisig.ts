import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import keypair from "../keypair.json";

const script = async () => {
  const creator = Keypair.fromSecretKey(Uint8Array.from(keypair));

  const configAuthority = new PublicKey(
    "G2aqM5vUEaRyidYL9NzkpVujiCoqwCocg2m7gkAH4USd"
  );

  const connection = new Connection(process.env.RPC as string);

  const createKey = creator;

  const [multisigPda] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
  });

  const programConfigPda = multisig.getProgramConfigPda({})[0];

  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      programConfigPda
    );

  const configTreasury = programConfig.treasury;

  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 2000,
  });

  const ix = multisig.instructions.multisigCreateV2({
    //blockhash: (await connection.getLatestBlockhash()).blockhash,
    treasury: configTreasury,
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    timeLock: 0,
    threshold: 1,
    rentCollector: null,
    members: [
      {
        key: creator.publicKey,
        permissions: multisig.types.Permissions.all(),
      },
    ],
  });

  const tx = new Transaction().add(addPriorityFee).add(ix);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(creator);

  const a = await connection.sendRawTransaction(tx.serialize());
  console.log("TX: ", a);
  const b = await connection.confirmTransaction(a);
  console.log("CONFIRM: ", b.value);
};

script();
