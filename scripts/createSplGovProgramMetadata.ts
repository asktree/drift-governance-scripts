import { withUpdateProgramMetadata } from "@solana/spl-governance";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import keypair from "../keypair.json";

const script = async () => {
  const connection = new Connection(process.env.RPC as string);

  const creator = Keypair.fromSecretKey(Uint8Array.from(keypair));

  const instructions: TransactionInstruction[] = [];
  const programId = new PublicKey(
    "dgov7NC8iaumWw3k8TkmLDybvZBCmd1qwxgLAGAsWxf"
  );
  await withUpdateProgramMetadata(
    instructions,
    programId,
    3,
    creator.publicKey
  );

  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 2000,
  });
  const tx = new Transaction().add(addPriorityFee).add(...instructions);
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(creator);

  const a = await connection.sendRawTransaction(tx.serialize());
  console.log("TX: ", a);
  const b = await connection.confirmTransaction(a);
  console.log("CONFIRM: ", b.value);
};

script();
