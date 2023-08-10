import { Button, Card, FlameSVG, GasPumpSVG, Input, WalletSVG } from "@ensdomains/thorin";
import { useChains, useModal } from "connectkit";
import { FactoryABI } from "../../../pages/abi/factory_abi";
import { FC, useMemo, useState } from "react";
import { Address, useAccount, useChainId, useConnect, useContractWrite, useFeeData, usePrepareContractWrite } from "wagmi";
import { formatEther } from "viem";

// https url that must include '{sender}'
const gatewayRegex = new RegExp("^https://.*{sender}.*$");
// address[] that must include 0x and are seperated by ,
const signersRegex = new RegExp("^\\[0x[0-9a-fA-F]{40}(,0x[0-9a-fA-F]{40})*\\]$");

const signersToArray = (signers: string) => {
    if (!signersRegex.test(signers.trim())) return null;
    const n_signers = signers.trim().slice(1, -1).split(',');

    return n_signers;
};

const deployments: Record<number, {
    factory?: Address,
    resolver?: Address,
}> = {
    1: {
        factory: '0x0',
    },
    5: {
        factory: '0x2F180aDBAAb3c57af31B7E96969999D4FB33faEE',
    }
}

export const DeployResolverCard: FC = () => {
    const { isConnected } = useAccount();
    const chainId = useChainId();
    const { setOpen } = useModal();
    const [gatewayUrl, setGatewayUrl] = useState<string>("");
    const [signers, setSigners] = useState<string>("");

    const isGatewayUrlValid = gatewayRegex.test(gatewayUrl.trim());
    const isSignersValid = signersRegex.test(signers.trim());

    const isReady = isGatewayUrlValid && isSignersValid;

    const factoryAddress = deployments[chainId]?.factory;

    const { data: FeeData } = useFeeData({ chainId, formatUnits: chainId == 5 ? 'kwei' : 'gwei' });

    const { config, data: EstimateData, error, isSuccess, isLoading } = usePrepareContractWrite({
        address: factoryAddress,
        chainId,
        functionName: 'createOffchainResolver',
        args: [gatewayUrl, signersToArray(signers)],
        abi: FactoryABI,
        enabled: isReady,
    });
    const { write, data } = useContractWrite(config as any);

    const gas = useMemo(() => {
        if (!EstimateData) return null;
        if (!FeeData) return null;
        if (!FeeData.gasPrice) return null;

        const num = FeeData.gasPrice.mul(EstimateData.request.gasLimit);
        const goerliOffset = chainId == 5 ? 1000n : 1n;

        return {
            // Is it me or is goerli fee data off by /1000
            gasTotal: formatEther(num.toBigInt() / goerliOffset, 'gwei').substring(0, 8),
        }
    }, [FeeData, EstimateData]);

    return (
        <Card className="leading-6 gap-2">
            <div className="">
                <h2 className="font-bold">Deploy an Offchain Resolver</h2>
                <p className="text-neutral-700">
                    In order to ensure you get these settings right, please read <a className="link">this page</a>.
                </p>
            </div>

            <Input
                label="Gateway URL"
                value={gatewayUrl}
                onChange={
                    (event) => {
                        setGatewayUrl(event.target.value);
                    }
                }
                error={gatewayUrl.trim() !== "" && !isGatewayUrlValid && 'Gateway URL must be a valid https url that includes "{sender}"'}
                placeholder="https://example.com/{sender}/{data}.json"
            />
            <Input
                label="Signers (address[])"
                value={signers}
                onChange={
                    (event) => {
                        setSigners(event.target.value);
                    }
                }
                error={signers.trim() !== "" && !isSignersValid && 'Signers must be a valid array of addresses seperated by ,'}
                placeholder="[0x225f137127d9067788314bc7fcc1f36746a3c3B5]"
            />

            {
                !isConnected && (
                    <Button onClick={() => { setOpen(true) }}>
                        Connect Wallet
                    </Button>
                )
            }
            {
                error && (
                    <p className="text-red-500">
                        {JSON.stringify(error)}
                    </p>
                )
            }
            {
                EstimateData && (
                    <div className="flex justify-around items-center">
                        <div className="flex gap-2 items-center">
                            <GasPumpSVG />
                            {FeeData?.formatted?.gasPrice}
                        </div>
                        <div className="flex gap-2 items-center">
                            <FlameSVG />
                            {Number(EstimateData.request.gasLimit).toLocaleString()}
                        </div>
                        <div className="flex gap-2 items-center">
                            <WalletSVG /> {gas?.gasTotal}
                        </div>
                    </div>
                )
            }
            {
                isConnected && (
                    <Button disabled={!isReady || !write} onClick={() => {
                        write?.();
                    }}>
                        {
                            (() => {
                                if (isLoading) return "Estimating Fees...";
                                if (isSuccess) return "Deploy " + EstimateData?.request.gasLimit + " gas";

                                return "Deploy";
                            })()
                        }
                    </Button>
                )
            }
        </Card>
    )
};