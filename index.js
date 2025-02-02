import { config } from "dotenv";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";

// ABIs
import ERC721_CORE_ABI from "./abi/ERC721Core.json" assert { type: "json" };
import ERC721_HOOK_ABI from "./abi/ERC721Hook.json" assert { type: "json" };
import { ethers } from "ethers";

config();

/**
 *  TO RUN THIS SCRIPT: `yarn dev`
 *
 *  This script is an EXAMPLE of minting tokens on an ERC-721 Core contract that uses hooks. In order, this script:
 *   1. Installs the `beforeMint` hook on the ERC-721 Core contract (if not already present).
 *   2. Encodes the expected arguments for the `beforeMint` hook.
 *   3. Mints a new token.
 *
 *  The contract at `ERC721_BEFORE_MINT_HOOK_ADDRESS` is an `AllowlistMintHook` contract. For example purposes,
 *  this contract already has a claim condition set for a free mint, and no allowlist.
 *
 *  The contracts interacted with via this script can be found at: https://github.com/thirdweb-dev/contracts-next/
 */

const main = async () => {
  const PRIVATE_KEY = process.env.TEST_WALLET_PRIVATE_KEY;
  const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY;

  if (!PRIVATE_KEY || !SECRET_KEY) {
    throw new Error(
      "Please set the TEST_WALLET_PRIVATE_KEY and THIRDWEB_SECRET_KEY env vars."
    );
  }

  const chain = "goerli";
  const sdk = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, chain, {
    secretKey: SECRET_KEY,
  });

  // This is the core token contract that uses hooks. Implements the `TokenHookConsumer` interface.
  const ERC721_CORE_ADDRESS = "0x67F8C80274d87979B186E747282211A672E38c32";
  const ERC721_BEFORE_MINT_HOOK_ADDRESS =
    "0x9Ef026c82F6491eBA4EAC14378a3FEd397C9F282";

  const token = await sdk.getContractFromAbi(
    ERC721_CORE_ADDRESS,
    ERC721_CORE_ABI
  );

  console.log(
    "\nTotal supply before minting:",
    (await token.erc721.totalCirculatingSupply()).toString()
  );

  let allHooks = await token.call("getAllHooks", []);
  console.log("\nAll hooks installed on token contract:", allHooks);

  // This means the `beforeMint` hook is not installed, and so, minting is not enabled yet.
  if (allHooks.beforeMint == ethers.constants.AddressZero) {
    console.log("\nInstalling the beforeMint hook...");

    const tx = await token.call("installHook", [
      ERC721_BEFORE_MINT_HOOK_ADDRESS,
    ]);

    console.log("\nInstalled hook tx:", tx.receipt.transactionHash);

    allHooks = await token.call("getAllHooks", []);
    console.log("\nHooks after installation:", allHooks);
  } else {
    console.log("\nBeforeMint hook already installed at:", allHooks.beforeMint);
  }

  // Mint a new token.
  //
  //    1. Get the beforeMint hook contract address.
  //    2. Get the expected argument abi-encoding types for mint() call args.
  //    3. Call mint (to_address, quantity, encoded_args_data)

  const beforeMintHookContract = await sdk.getContractFromAbi(
    ERC721_BEFORE_MINT_HOOK_ADDRESS,
    ERC721_HOOK_ABI
  );

  const expectedEncoding = (
    await beforeMintHookContract.call("getBeforeMintArgSignature", [])
  ).split("|");

  console.log("\nExpected encoding format:", expectedEncoding);

  /**
   *  Here, we know beforehand to anticipate `bytes32[]` as the encoding type, because we know we're working with the
   *  `AllowlistMintHook` contract. And so, we can provide the intended arguments to the hook in the expected format.
   *
   *  Therefore, it is expected that you know of the encoding format of the beforeMint hook that you're using.
   */
  const encodedBeforeMintArgs = ethers.utils.defaultAbiCoder.encode(
    expectedEncoding,
    [[]]
  );
  const toAddress = await sdk.getSigner().getAddress();
  const quantityToMint = 1;

  console.log(`\nMinting ${quantityToMint} tokens to: ${toAddress}`);

  const mintTx = await token.call("mint", [
    toAddress,
    quantityToMint,
    encodedBeforeMintArgs,
  ]);

  console.log("\nMint tx:", mintTx.receipt.transactionHash);

  console.log(
    "\nTotal supply after mint:",
    (await token.erc721.totalCirculatingSupply()).toString()
  );
};

main();
