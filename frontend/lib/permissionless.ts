/* eslint-disable prettier/prettier */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { ERC20_ABI } from "./ABI";
import { ENTRYPOINT_ADDRESS_V07, SmartAccountClient, createSmartAccountClient, walletClientToSmartAccountSigner } from "permissionless";
import { SafeSmartAccount, signerToSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoBundlerClient, createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { Address, Chain, Hex, Transport, WalletClient, createPublicClient, encodeFunctionData, erc20Abi, http } from "viem";
import { erc7579Actions, Erc7579Actions } from 'permissionless/actions/erc7579'
import { EntryPoint } from "permissionless/types/entrypoint";

const transportUrl = (chain: Chain) =>
  `https://api.pimlico.io/v2/${chain.id}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY}`;


const safe4337ModuleAddress = '0x3Fdb5BC686e861480ef99A6E3FaAe03c0b9F32e2'
const erc7579LaunchpadAddress = '0xEBe001b3D534B9B6E2500FB78E67a1A137f561CE'

export const publicClient = (chain: Chain) =>
  createPublicClient({
    transport: http(process.env.NEXT_PUBLIC_JSON_RPC ?? "https://rpc.ankr.com/eth_sepolia"),
  });

export const paymasterClient = (chain: Chain) =>
  createPimlicoPaymasterClient({
    transport: http(transportUrl(chain)),
    entryPoint: ENTRYPOINT_ADDRESS_V07,
  });

export const pimlicoBundlerClient = (chain: Chain) =>
  createPimlicoBundlerClient({
    transport: http(transportUrl(chain)),
    entryPoint: ENTRYPOINT_ADDRESS_V07,
  });


export const getSafeAccount = async (chain: Chain, walletClient: WalletClient) => {
  const signer = walletClientToSmartAccountSigner(walletClient as any);

  return await signerToSafeSmartAccount(publicClient(chain), {
    entryPoint: ENTRYPOINT_ADDRESS_V07,
    signer,
    safeVersion: '1.4.1',
    saltNonce: 121n,
    safe4337ModuleAddress,
    erc7579LaunchpadAddress
  });
}

export type SafeSmartAccountClient = SmartAccountClient<
  EntryPoint,
  Transport,
  Chain,
  SafeSmartAccount<EntryPoint>
> &
  Erc7579Actions<EntryPoint, SafeSmartAccount<EntryPoint>>

export const getPimlicoSmartAccountClient = async (
  safeSmartAccountClient: any,
  chain: Chain,
) => {
  const smartAccountClient = createSmartAccountClient({
    account: safeSmartAccountClient,
    entryPoint: ENTRYPOINT_ADDRESS_V07,
    chain,
    bundlerTransport: http(transportUrl(chain), {
      timeout: 30_000
    }),
    middleware: {
      gasPrice: async () => (await pimlicoBundlerClient(chain).getUserOperationGasPrice()).fast, // use pimlico bundler to get gas prices
      sponsorUserOperation: ({ userOperation }) => {
        return paymasterClient(chain).sponsorUserOperation({
          userOperation,
          sponsorshipPolicyId: "sp_early_synch"
        })
      }
    },
  }).extend(erc7579Actions({ entryPoint: ENTRYPOINT_ADDRESS_V07 }));

  return smartAccountClient as SafeSmartAccountClient;
};

