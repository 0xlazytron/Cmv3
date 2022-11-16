import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import confetti from "canvas-confetti";
import fb from "./img/icons/fb.svg";
import down from "./img/icons/downarr.svg";
import insta from "./img/icons/insta.svg";
import lin from "./img/icons/lin.svg";
import yt from "./img/icons/yt.svg";
import twt from "./img/icons/twitter.svg";
import anime from "./img/10-genietenvrouw-180x168-1.png";
import wllet from "./img/icons/wallet.svg";
import * as anchor from "@project-serum/anchor";
import {
  Commitment,
  Connection,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { GatewayProvider } from "@civic/solana-gateway-react";
import Countdown from "react-countdown";
import { Snackbar, Paper, LinearProgress, Chip } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { AlertState, getAtaForMint, toDate } from "./utils";
import { MintButton } from "./MintButton";
import {
  awaitTransactionSignatureConfirmation,
  CANDY_MACHINE_PROGRAM,
  CandyMachineAccount,
  createAccountsForMint,
  getCandyMachineState,
  getCollectionPDA,
  mintOneToken,
  SetupState,
} from "./candy-machine";
import { useNavigate } from "react-router-dom";

const cluster = process.env.REACT_APP_SOLANA_NETWORK!.toString();
const decimals = process.env.REACT_APP_SPL_TOKEN_TO_MINT_DECIMALS
  ? +process.env.REACT_APP_SPL_TOKEN_TO_MINT_DECIMALS!.toString()
  : 9;
const splTokenName = process.env.REACT_APP_SPL_TOKEN_TO_MINT_NAME
  ? process.env.REACT_APP_SPL_TOKEN_TO_MINT_NAME.toString()
  : "TOKEN";

const WalletContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: right;
`;

const WalletAmount = styled.div`
  color: black;
  width: auto;
  padding: 5px 5px 5px 16px;
  min-width: 48px;
  min-height: auto;
  border-radius: 22px;
  background-color: var(--main-text-color);
  box-shadow: 0px 3px 5px -1px rgb(0 0 0 / 20%),
    0px 6px 10px 0px rgb(0 0 0 / 14%), 0px 1px 18px 0px rgb(0 0 0 / 12%);
  box-sizing: border-box;
  transition: background-color 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
    box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms,
    border 250ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  font-weight: 500;
  line-height: 1.75;
  text-transform: uppercase;
  border: 0;
  margin: 0;
  display: inline-flex;
  outline: 0;
  position: relative;
  align-items: center;
  user-select: none;
  vertical-align: middle;
  justify-content: flex-start;
  gap: 10px;
`;

const Wallet = styled.ul`
  flex: 0 0 auto;
  margin: 0;
  padding: 0;
`;

const ConnectButton = styled(WalletMultiButton)`
  border-radius: 18px !important;
  padding: 6px 16px;
  background-color: #cf511f;
  margin: 0 auto;
`;

const NFT = styled(Paper)`
  min-width: 500px;
  margin: 0 auto;
  padding: 5px 20px 20px 20px;
  flex: 1 1 auto;
  background-color: var(--card-background-color) !important;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.25), 0 10px 10px rgba(0, 0, 0, 0.22) !important;
`;

const Card = styled(Paper)`
  display: inline-block;
  background-color: var(--countdown-background-color) !important;
  margin: 5px;
  min-width: 40px;
  padding: 24px;

  h1 {
    margin: 0px;
  }
`;

const MintButtonContainer = styled.div`
  button.MuiButton-contained:not(.MuiButton-containedPrimary).Mui-disabled {
    color: #464646;
  }

  button.MuiButton-contained:not(.MuiButton-containedPrimary):hover,
  button.MuiButton-contained:not(.MuiButton-containedPrimary):focus {
    -webkit-animation: pulse 1s;
    animation: pulse 1s;
    box-shadow: 0 0 0 2em rgba(255, 255, 255, 0);
  }

  @-webkit-keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 #ef8f6e;
    }
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 #ef8f6e;
    }
  }
`;

const SolExplorerLink = styled.a`
  color: var(--title-text-color);
  border-bottom: 1px solid var(--title-text-color);
  font-weight: bold;
  list-style-image: none;
  list-style-position: outside;
  list-style-type: none;
  outline: none;
  text-decoration: none;
  text-size-adjust: 100%;

  :hover {
    border-bottom: 2px solid var(--title-text-color);
  }
`;

const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: 20px;
  margin-bottom: 20px;
  margin-right: 4%;
  margin-left: 4%;
  text-align: center;
  justify-content: center;
`;

const MintContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 20px;
`;

const DesContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  gap: 20px;
`;

const Price = styled(Chip)`
  position: absolute;
  margin: 5px;
  font-weight: bold;
  font-size: 1.2em !important;
  font-family: "Patrick Hand", cursive !important;
`;

const Image = styled.img`
  height: 400px;
  width: auto;
  border-radius: 7px;
  box-shadow: 5px 5px 40px 5px rgba(0, 0, 0, 0.5);
`;

const BorderLinearProgress = styled(LinearProgress)`
  margin: 20px;
  height: 10px !important;
  border-radius: 30px;
  border: 2px solid white;
  box-shadow: 5px 5px 40px 5px rgba(0, 0, 0, 0.5);
  background-color: var(--main-text-color) !important;

  > div.MuiLinearProgress-barColorPrimary {
    background-color: var(--title-text-color) !important;
  }

  > div.MuiLinearProgress-bar1Determinate {
    border-radius: 30px !important;
    background-image: linear-gradient(
      270deg,
      rgba(255, 255, 255, 0.01),
      rgba(255, 255, 255, 0.5)
    );
  }
`;

export interface HomeProps {
  candyMachineId?: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  txTimeout: number;
  rpcHost: string;
  network: WalletAdapterNetwork;
}

const Home = (props: HomeProps) => {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>();
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
  const [isActive, setIsActive] = useState(false); // true when countdown completes or whitelisted
  const [solanaExplorerLink, setSolanaExplorerLink] = useState<string>("");
  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  const [itemsRemaining, setItemsRemaining] = useState(0);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [payWithSplToken, setPayWithSplToken] = useState(false);
  const [price, setPrice] = useState(0);
  const [priceLabel, setPriceLabel] = useState<string>("SOL");
  const [whitelistPrice, setWhitelistPrice] = useState(0);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [isBurnToken, setIsBurnToken] = useState(false);
  const [whitelistTokenBalance, setWhitelistTokenBalance] = useState(0);
  const [isEnded, setIsEnded] = useState(false);
  const [endDate, setEndDate] = useState<Date>();
  const [isPresale, setIsPresale] = useState(false);
  const [isWLOnly, setIsWLOnly] = useState(false);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [needTxnSplit, setNeedTxnSplit] = useState(true);
  const [setupTxn, setSetupTxn] = useState<SetupState>();

  const wallet = useWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>();

  const rpcUrl = props.rpcHost;
  const solFeesEstimation = 0.012; // approx of account creation fees

  const anchorWallet = useMemo(() => {
    if (
      !wallet ||
      !wallet.publicKey ||
      !wallet.signAllTransactions ||
      !wallet.signTransaction
    ) {
      return;
    }

    return {
      publicKey: wallet.publicKey,
      signAllTransactions: wallet.signAllTransactions,
      signTransaction: wallet.signTransaction,
    } as anchor.Wallet;
  }, [wallet]);

  const refreshCandyMachineState = useCallback(
    async (commitment: Commitment = "confirmed") => {
      if (!anchorWallet) {
        return;
      }

      const connection = new Connection(props.rpcHost, commitment);

      if (props.candyMachineId) {
        try {
          const cndy = await getCandyMachineState(
            anchorWallet,
            props.candyMachineId,
            connection
          );

          setCandyMachine(cndy);
          setItemsAvailable(cndy.state.itemsAvailable);
          setItemsRemaining(cndy.state.itemsRemaining);
          setItemsRedeemed(cndy.state.itemsRedeemed);

          var divider = 1;
          if (decimals) {
            divider = +("1" + new Array(decimals).join("0").slice() + "0");
          }

          // detect if using spl-token to mint
          if (cndy.state.tokenMint) {
            setPayWithSplToken(true);
            // Customize your SPL-TOKEN Label HERE
            // TODO: get spl-token metadata name
            setPriceLabel(splTokenName);
            setPrice(cndy.state.price.toNumber() / divider);
            setWhitelistPrice(cndy.state.price.toNumber() / divider);
          } else {
            setPrice(cndy.state.price.toNumber() / LAMPORTS_PER_SOL);
            setWhitelistPrice(cndy.state.price.toNumber() / LAMPORTS_PER_SOL);
          }

          // fetch whitelist token balance
          if (cndy.state.whitelistMintSettings) {
            setWhitelistEnabled(true);
            setIsBurnToken(cndy.state.whitelistMintSettings.mode.burnEveryTime);
            setIsPresale(cndy.state.whitelistMintSettings.presale);
            setIsWLOnly(
              !isPresale &&
                cndy.state.whitelistMintSettings.discountPrice === null
            );

            if (
              cndy.state.whitelistMintSettings.discountPrice !== null &&
              cndy.state.whitelistMintSettings.discountPrice !==
                cndy.state.price
            ) {
              if (cndy.state.tokenMint) {
                setWhitelistPrice(
                  cndy.state.whitelistMintSettings.discountPrice?.toNumber() /
                    divider
                );
              } else {
                setWhitelistPrice(
                  cndy.state.whitelistMintSettings.discountPrice?.toNumber() /
                    LAMPORTS_PER_SOL
                );
              }
            }

            let balance = 0;
            try {
              const tokenBalance =
                await props.connection.getTokenAccountBalance(
                  (
                    await getAtaForMint(
                      cndy.state.whitelistMintSettings.mint,
                      anchorWallet.publicKey
                    )
                  )[0]
                );

              balance = tokenBalance?.value?.uiAmount || 0;
            } catch (e) {
              console.error(e);
              balance = 0;
            }
            if (commitment !== "processed") {
              setWhitelistTokenBalance(balance);
            }
            setIsActive(isPresale && !isEnded && balance > 0);
          } else {
            setWhitelistEnabled(false);
          }

          // end the mint when date is reached
          if (cndy?.state.endSettings?.endSettingType.date) {
            setEndDate(toDate(cndy.state.endSettings.number));
            if (
              cndy.state.endSettings.number.toNumber() <
              new Date().getTime() / 1000
            ) {
              setIsEnded(true);
              setIsActive(false);
            }
          }
          // end the mint when amount is reached
          if (cndy?.state.endSettings?.endSettingType.amount) {
            let limit = Math.min(
              cndy.state.endSettings.number.toNumber(),
              cndy.state.itemsAvailable
            );
            setItemsAvailable(limit);
            if (cndy.state.itemsRedeemed < limit) {
              setItemsRemaining(limit - cndy.state.itemsRedeemed);
            } else {
              setItemsRemaining(0);
              cndy.state.isSoldOut = true;
              setIsEnded(true);
            }
          } else {
            setItemsRemaining(cndy.state.itemsRemaining);
          }

          if (cndy.state.isSoldOut) {
            setIsActive(false);
          }

          const [collectionPDA] = await getCollectionPDA(props.candyMachineId);
          const collectionPDAAccount = await connection.getAccountInfo(
            collectionPDA
          );

          const txnEstimate =
            892 +
            (!!collectionPDAAccount && cndy.state.retainAuthority ? 182 : 0) +
            (cndy.state.tokenMint ? 66 : 0) +
            (cndy.state.whitelistMintSettings ? 34 : 0) +
            (cndy.state.whitelistMintSettings?.mode?.burnEveryTime ? 34 : 0) +
            (cndy.state.gatekeeper ? 33 : 0) +
            (cndy.state.gatekeeper?.expireOnUse ? 66 : 0);

          setNeedTxnSplit(txnEstimate > 1230);
        } catch (e) {
          if (e instanceof Error) {
            if (
              e.message === `Account does not exist ${props.candyMachineId}`
            ) {
              setAlertState({
                open: true,
                message: `Couldn't fetch candy machine state from candy machine with address: ${props.candyMachineId}, using rpc: ${props.rpcHost}! You probably typed the REACT_APP_CANDY_MACHINE_ID value in wrong in your .env file, or you are using the wrong RPC!`,
                severity: "error",
                hideDuration: null,
              });
            } else if (
              e.message.startsWith("failed to get info about account")
            ) {
              setAlertState({
                open: true,
                message: `Couldn't fetch candy machine state with rpc: ${props.rpcHost}! This probably means you have an issue with the REACT_APP_SOLANA_RPC_HOST value in your .env file, or you are not using a custom RPC!`,
                severity: "error",
                hideDuration: null,
              });
            }
          } else {
            setAlertState({
              open: true,
              message: `${e}`,
              severity: "error",
              hideDuration: null,
            });
          }
          console.log(e);
        }
      } else {
        setAlertState({
          open: true,
          message: `Your REACT_APP_CANDY_MACHINE_ID value in the .env file doesn't look right! Make sure you enter it in as plain base-58 address!`,
          severity: "error",
          hideDuration: null,
        });
      }
    },
    [
      anchorWallet,
      props.candyMachineId,
      props.rpcHost,
      isEnded,
      isPresale,
      props.connection,
    ]
  );

  const renderGoLiveDateCounter = ({ days, hours, minutes, seconds }: any) => {
    return (
      <div>
        <Card elevation={1}>
          <h1>{days}</h1>Days
        </Card>
        <Card elevation={1}>
          <h1>{hours}</h1>
          Hours
        </Card>
        <Card elevation={1}>
          <h1>{minutes}</h1>Mins
        </Card>
        <Card elevation={1}>
          <h1>{seconds}</h1>Secs
        </Card>
      </div>
    );
  };

  const renderEndDateCounter = ({ days, hours, minutes }: any) => {
    let label = "";
    if (days > 0) {
      label += days + " days ";
    }
    if (hours > 0) {
      label += hours + " hours ";
    }
    label += minutes + 1 + " minutes left to MINT.";
    return (
      <div>
        <h3>{label}</h3>
      </div>
    );
  };

  function displaySuccess(mintPublicKey: any, qty: number = 1): void {
    let remaining = itemsRemaining - qty;
    setItemsRemaining(remaining);
    setIsSoldOut(remaining === 0);
    if (isBurnToken && whitelistTokenBalance && whitelistTokenBalance > 0) {
      let balance = whitelistTokenBalance - qty;
      setWhitelistTokenBalance(balance);
      setIsActive(isPresale && !isEnded && balance > 0);
    }
    setSetupTxn(undefined);
    setItemsRedeemed(itemsRedeemed + qty);
    if (!payWithSplToken && balance && balance > 0) {
      setBalance(
        balance -
          (whitelistEnabled ? whitelistPrice : price) * qty -
          solFeesEstimation
      );
    }
    setSolanaExplorerLink(
      cluster === "devnet" || cluster === "testnet"
        ? "https://solscan.io/token/" + mintPublicKey + "?cluster=" + cluster
        : "https://solscan.io/token/" + mintPublicKey
    );
    setIsMinting(false);
    throwConfetti();
  }

  function throwConfetti(): void {
    confetti({
      particleCount: 400,
      spread: 70,
      origin: { y: 0.6 },
    });
  }

  const onMint = async (
    beforeTransactions: Transaction[] = [],
    afterTransactions: Transaction[] = []
  ) => {
    try {
      if (wallet.connected && candyMachine?.program && wallet.publicKey) {
        setIsMinting(true);
        let setupMint: SetupState | undefined;
        if (needTxnSplit && setupTxn === undefined) {
          setAlertState({
            open: true,
            message: "Please validate account setup transaction",
            severity: "info",
          });
          setupMint = await createAccountsForMint(
            candyMachine,
            wallet.publicKey
          );
          let status: any = { err: true };
          if (setupMint.transaction) {
            status = await awaitTransactionSignatureConfirmation(
              setupMint.transaction,
              props.txTimeout,
              props.connection,
              true
            );
          }
          if (status && !status.err) {
            setSetupTxn(setupMint);
            setAlertState({
              open: true,
              message:
                "Setup transaction succeeded! You can now validate mint transaction",
              severity: "info",
            });
          } else {
            setAlertState({
              open: true,
              message: "Mint failed! Please try again!",
              severity: "error",
            });
            return;
          }
        }

        const setupState = setupMint ?? setupTxn;
        const mint = setupState?.mint ?? anchor.web3.Keypair.generate();
        let mintResult = await mintOneToken(
          candyMachine,
          wallet.publicKey,
          mint,
          beforeTransactions,
          afterTransactions,
          setupState
        );

        let status: any = { err: true };
        let metadataStatus = null;
        if (mintResult) {
          status = await awaitTransactionSignatureConfirmation(
            mintResult.mintTxId,
            props.txTimeout,
            props.connection,
            true
          );

          metadataStatus =
            await candyMachine.program.provider.connection.getAccountInfo(
              mintResult.metadataKey,
              "processed"
            );
          console.log("Metadata status: ", !!metadataStatus);
        }

        if (status && !status.err && metadataStatus) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });

          navigate("/minted");

          displaySuccess(mint.publicKey);
          refreshCandyMachineState("processed");
        } else if (status && !status.err) {
          setAlertState({
            open: true,
            message:
              "Mint likely failed! Anti-bot SOL 0.01 fee potentially charged! Check the explorer to confirm the mint failed and if so, make sure you are eligible to mint before trying again.",
            severity: "error",
            hideDuration: 8000,
          });
          refreshCandyMachineState();
        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
          refreshCandyMachineState();
        }
      }
    } catch (error: any) {
      let message = error.msg || "Minting failed! Please try again!";
      if (!error.msg) {
        if (!error.message) {
          message = "Transaction Timeout! Please try again.";
        } else if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      setIsMinting(false);
    }
  };

  useEffect(() => {
    (async () => {
      if (anchorWallet) {
        const balance = await props.connection.getBalance(
          anchorWallet!.publicKey
        );
        setBalance(balance / LAMPORTS_PER_SOL);
      }
    })();
  }, [anchorWallet, props.connection]);

  useEffect(() => {
    refreshCandyMachineState();
  }, [
    anchorWallet,
    props.candyMachineId,
    props.connection,
    isEnded,
    isPresale,
    refreshCandyMachineState,
  ]);

  return (
    <main>
      <div id="wrap_all">
        <div id="main" className="all_colors" data-scroll-offset="70">
          <div
            id="top-section"
            className="avia-section alternate_color avia-section-default avia-no-border-styling  av-section-color-overlay-active avia-bg-style-scroll  avia-builder-el-0  avia-builder-el-no-sibling   av-minimum-height av-minimum-height-100  container_wrap fullsize"
            style={{ backgroundColor: "#f5f5f5" }}
            data-av_minimum_height_pc="100"
          >
            <div className="av-section-color-overlay-wrap">
              <div
                className="av-section-color-overlay"
                style={{ opacity: "0.8", backgroundColor: "#ffffff" }}
              ></div>
              <a
                href="#next-section"
                title=""
                className="scroll-down-link "
                style={{ height: "40px", width: "40px" }}
              >
                <img src={down} alt="" />
              </a>
              <div className="container">
                <main
                  role="main"
                  className="template-page content  av-content-full alpha units"
                >
                  <div className="post-entry post-entry-type-page post-entry-8872">
                    <div className="entry-content-wrapper clearfix">
                      <div className="flex_column_table av-equal-height-column-flextable -flextable">
                        <div
                          className="flex_column av_two_fifth  no_margin flex_column_table_cell av-equal-height-column av-align-middle av-zero-column-padding avia-link-column av-column-link first  avia-builder-el-1  el_before_av_three_fifth  avia-builder-el-first  "
                          style={{ borderRadius: "0px" }}
                          data-link-column-url="#aanmelden"
                          id="btn-bhai"
                        >
                          <a
                            className="av-screen-reader-only"
                            href="#aanmelden"
                          >
                            Follow a manual added link
                          </a>
                          <div className="avia-image-container  av-styling-    avia-builder-el-2  el_before_av_textblock  avia-builder-el-first  avia-align-center ">
                            <div className="avia-image-container-inner">
                              <div className="avia-image-overlay-wrap">
                                <img
                                  className="wp-image-4647 avia-img-lazy-loading-not-4647 avia_image"
                                  src={anime}
                                  alt=""
                                  title="Domein Bergen"
                                  height="289"
                                  width="300"
                                />
                              </div>
                              <button
                                className="avia_iconbox_title"
                                id="mint-btn-2"
                                style={{ alignItems: "center" }}
                              >
                                {wallet ? (
                                  <WalletAmount>
                                    {(balance || 0).toLocaleString()} SOL
                                    <ConnectButton />
                                  </WalletAmount>
                                ) : (
                                  <ConnectButton>Connect Wallet</ConnectButton>
                                )}
                              </button>
                            </div>
                          </div>
                          <section className="av_textblock_section">
                            <div className="avia_textblock">
                              <p style={{ textAlign: "center", color: "#000" }}>
                                You own {(balance || 0).toLocaleString()} SOL In
                                Your Wallet
                              </p>
                            </div>
                          </section>
                        </div>
                        <div
                          className="flex_column av_three_fifth  no_margin flex_column_table_cell av-equal-height-column av-align-middle   avia-builder-el-4  el_after_av_two_fifth  avia-builder-el-last  newslatter-frm "
                          style={{
                            padding: "35px 20px 20px 20px",
                            borderRadius: "0px",
                          }}
                        >
                          <div
                            style={{
                              paddingBottom: "10px",
                              margin: "0px 0px 0px 0px",
                              color: "#53632e",
                            }}
                            className="av-special-heading av-special-heading-h1 custom-color-heading blockquote modern-quote modern-centered  avia-builder-el-5  el_before_av_textblock  avia-builder-el-first  "
                          >
                            <h1 className="av-special-heading-tag ">
                              one more step&hellip;
                            </h1>
                            <div className="special-heading-border">
                              <div
                                className="special-heading-inner-border"
                                style={{ borderColor: "#53632e" }}
                              ></div>
                            </div>
                          </div>
                          <section className="av_textblock_section ">
                            <div
                              className="avia_textblock  av_inherit_color "
                              style={{ color: "#999999" }}
                            >
                              <em>
                                <p style={{ textAlign: "center" }}>
                                  you have paid the solana now next we will
                                  deduct the required DBC to Mint your Grapevine
                                  NFTree
                                  {/* {whitelistTokenBalance < 250 ? "You need at least 250 DBC and 1 Solana in your wallet to mint a Golden Grapevine NFT" : "You Can Mint GrapeVine NFT"} */}
                                </p>
                              </em>
                            </div>
                          </section>
                          <div className=" avia-button-center">
                            {/* <p>{wallet && isActive &&
                                                                <h3>TOTAL MINTED : {itemsRedeemed} / {itemsAvailable}</h3>}
                                                            {wallet && isActive && <BorderLinearProgress variant="determinate"
                                                                value={100 - (itemsRemaining * 100 / itemsAvailable)} />}</p> <br /> */}
                            <span
                              className="avia-button-center avia-button avia-icon_select-no avia-size-small avia-position-center"
                              id="mint-btn"
                            >
                              <MintButtonContainer>
                                {!isActive &&
                                !isEnded &&
                                candyMachine?.state.goLiveDate &&
                                (!isWLOnly || whitelistTokenBalance > 0) ? (
                                  <Countdown
                                    date={toDate(
                                      candyMachine?.state.goLiveDate
                                    )}
                                    onMount={({ completed }) =>
                                      completed && setIsActive(!isEnded)
                                    }
                                    onComplete={() => {
                                      setIsActive(!isEnded);
                                    }}
                                    renderer={renderGoLiveDateCounter}
                                  />
                                ) : !wallet ? (
                                  <ConnectButton>Connect Wallet</ConnectButton>
                                ) : !isWLOnly || whitelistTokenBalance > 0 ? (
                                  candyMachine?.state.gatekeeper &&
                                  wallet.publicKey &&
                                  wallet.signTransaction ? (
                                    <GatewayProvider
                                      wallet={{
                                        publicKey:
                                          wallet.publicKey ||
                                          new PublicKey(CANDY_MACHINE_PROGRAM),
                                        //@ts-ignore
                                        signTransaction: wallet.signTransaction,
                                      }}
                                      // // Replace with following when added
                                      // gatekeeperNetwork={candyMachine.state.gatekeeper_network}
                                      gatekeeperNetwork={
                                        candyMachine?.state?.gatekeeper
                                          ?.gatekeeperNetwork
                                      } // This is the ignite (captcha) network
                                      /// Don't need this for mainnet
                                      clusterUrl={rpcUrl}
                                      cluster={cluster}
                                      options={{ autoShowModal: false }}
                                    >
                                      <MintButton
                                        candyMachine={candyMachine}
                                        isMinting={isMinting}
                                        isActive={isActive}
                                        isEnded={isEnded}
                                        isSoldOut={isSoldOut}
                                        onMint={onMint}
                                      />
                                    </GatewayProvider>
                                  ) : (
                                    <MintButton
                                      candyMachine={candyMachine}
                                      isMinting={isMinting}
                                      isActive={isActive}
                                      isEnded={isEnded}
                                      isSoldOut={isSoldOut}
                                      onMint={onMint}
                                    />
                                  )
                                ) : (
                                  <h1>Mint is private.</h1>
                                )}
                              </MintButtonContainer>
                              <br />
                              {wallet && isActive && solanaExplorerLink && (
                                <>
                                  <SolExplorerLink
                                    href={solanaExplorerLink}
                                    target="_blank"
                                  >
                                    View on Solscan
                                  </SolExplorerLink>{" "}
                                  <br />
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </main>
              </div>
            </div>
          </div>

          <footer
            className="container_wrap socket_color"
            id="socket"
            role="contentinfo"
          >
            <div className="container">
              <span className="copyright">&copy; 2020 Domein Bergen </span>

              <ul className="noLightbox social_bookmarks icon_count_5">
                <li className="social_bookmarks_facebook av-social-link-facebook">
                  <a
                    target="_blank"
                    aria-label="Link to Facebook"
                    href="https://www.facebook.com/domeinbergen"
                    aria-hidden="false"
                    title="Facebook"
                    rel="noopener"
                  >
                    <img
                      src={fb}
                      alt=""
                      style={{ height: "12px", width: "12px" }}
                    />
                    <span className="avia_hidden_link_text">Facebook</span>
                  </a>
                </li>
                <li className="social_bookmarks_instagram av-social-link-instagram ">
                  <a
                    target="_blank"
                    aria-label="Link to Instagram"
                    href="https://www.instagram.com/domeinbergen/"
                    title="Instagram"
                    rel="noopener"
                  >
                    <img
                      src={insta}
                      alt=""
                      style={{ height: "12px", width: "12px" }}
                    />
                    <span className="avia_hidden_link_text">Instagram</span>
                  </a>
                </li>
                <li className="social_bookmarks_youtube av-social-link-youtube ">
                  <a
                    target="_blank"
                    aria-label="Link to Youtube"
                    href="https://youtube.com/channel/UCouHQU-GoqjrhvnAOHWGFcQ"
                    title="Youtube"
                    rel="noopener"
                  >
                    <img
                      src={yt}
                      alt=""
                      style={{ height: "12px", width: "12px" }}
                    />
                    <span className="avia_hidden_link_text">Youtube</span>
                  </a>
                </li>
                <li className="social_bookmarks_twitter av-social-link-twitter ">
                  <a
                    target="_blank"
                    aria-label="Link to Twitter"
                    href="https://twitter.com/sicodemoel"
                    title="Twitter"
                    rel="noopener"
                  >
                    <img
                      src={twt}
                      alt=""
                      style={{ height: "12px", width: "12px" }}
                    />
                    <span className="avia_hidden_link_text">Twitter</span>
                  </a>
                </li>
                <li className="social_bookmarks_linkedin av-social-link-linkedin">
                  <a
                    target="_blank"
                    aria-label="Link to LinkedIn"
                    href="https://www.linkedin.com/in/sicodemoel/"
                    title="LinkedIn"
                    rel="noopener"
                  >
                    <img
                      src={lin}
                      alt=""
                      style={{ height: "12px", width: "12px" }}
                    />
                    <span className="avia_hidden_link_text">LinkedIn</span>
                  </a>
                </li>
              </ul>
              <nav className="sub_menu_socket" role="navigation">
                <div className="avia3-menu">
                  <ul id="avia3-menu" className="menu">
                    <li
                      id="menu-item-5348"
                      className="menu-item menu-item-type-custom menu-item-object-custom menu-item-top-level menu-item-top-level-1"
                    >
                      <a href="https://www.domeinbergen.nl/voorwaarden.pdf">
                        <span className="avia-bullet"></span>
                        <span className="avia-menu-text">
                          Algemene Voorwaarden
                        </span>
                        <span className="avia-menu-fx">
                          <span className="avia-arrow-wrap">
                            <span className="avia-arrow"></span>
                          </span>
                        </span>
                      </a>
                    </li>
                    <li
                      id="menu-item-5343"
                      className="menu-item menu-item-type-post_type menu-item-object-page menu-item-privacy-policy menu-item-top-level menu-item-top-level-2"
                    >
                      <a href="privacybeleid.html">
                        <span className="avia-bullet"></span>
                        <span className="avia-menu-text">Privacybeleid</span>
                        <span className="avia-menu-fx">
                          <span className="avia-arrow-wrap">
                            <span className="avia-arrow"></span>
                          </span>
                        </span>
                      </a>
                    </li>
                    <li
                      id="menu-item-5344"
                      className="menu-item menu-item-type-post_type menu-item-object-page menu-item-top-level menu-item-top-level-3"
                    >
                      <a href="contact.html">
                        <span className="avia-bullet"></span>
                        <span className="avia-menu-text">Contact</span>
                        <span className="avia-menu-fx">
                          <span className="avia-arrow-wrap">
                            <span className="avia-arrow"></span>
                          </span>
                        </span>
                      </a>
                    </li>
                  </ul>
                </div>
              </nav>
            </div>
          </footer>
        </div>
      </div>
      <a
        href="#top"
        title="Scroll to top"
        id="scroll-top-link"
        aria-hidden="true"
        data-av_icon="&#59510;"
        data-av_iconfont="entypo-fontello"
      >
        <span className="avia_hidden_link_text">Scroll to top</span>
      </a>
      <div id="fb-root"></div>

      {/* <MainContainer>
                <WalletContainer>
                    <Wallet>
                        {wallet ?
                            <WalletAmount>{(balance || 0).toLocaleString()} SOL<ConnectButton/></WalletAmount> :
                            <ConnectButton>Connect Wallet</ConnectButton>}
                    </Wallet>
                </WalletContainer>
                <br/>
                <MintContainer>
                    <DesContainer>
                        <NFT elevation={3}>
                            <h2>Buy the Grapevine NFTree</h2>
                            <br/>
                            <div><Price
                                label={isActive && whitelistEnabled && (whitelistTokenBalance > 0) ? (whitelistPrice + " " + priceLabel) : (price + " " + priceLabel)}/><Image
                                src="cool-cats.gif"
                                alt="NFT To Mint"/></div>
                            <br/>
                            {wallet && isActive && whitelistEnabled && (whitelistTokenBalance > 0) && isBurnToken &&
                              <h3>You own {whitelistTokenBalance} WL
                                mint {whitelistTokenBalance > 1 ? "tokens" : "token"}.</h3>}
                            {wallet && isActive && whitelistEnabled && (whitelistTokenBalance > 0) && !isBurnToken &&
                              <h3>You are whitelisted and allowed to mint.</h3>}
                            {wallet && isActive && endDate && Date.now() < endDate.getTime() &&
                              <Countdown
                                date={toDate(candyMachine?.state?.endSettings?.number)}
                                onMount={({completed}) => completed && setIsEnded(true)}
                                onComplete={() => {
                                    setIsEnded(true);
                                }}
                                renderer={renderEndDateCounter}
                              />}
                            {wallet && isActive &&
                              <h3>TOTAL MINTED : {itemsRedeemed} / {itemsAvailable}</h3>}
                            {wallet && isActive && <BorderLinearProgress variant="determinate"
                                                                         value={100 - (itemsRemaining * 100 / itemsAvailable)}/>}
                            <br/>
                            <MintButtonContainer>
                                {!isActive && !isEnded && candyMachine?.state.goLiveDate && (!isWLOnly || whitelistTokenBalance > 0) ? (
                                    <Countdown
                                        date={toDate(candyMachine?.state.goLiveDate)}
                                        onMount={({completed}) => completed && setIsActive(!isEnded)}
                                        onComplete={() => {
                                            setIsActive(!isEnded);
                                        }}
                                        renderer={renderGoLiveDateCounter}
                                    />) : (
                                    !wallet ? (
                                        <ConnectButton>Connect Wallet</ConnectButton>
                                    ) : (!isWLOnly || whitelistTokenBalance > 0) ?
                                        candyMachine?.state.gatekeeper &&
                                        wallet.publicKey &&
                                        wallet.signTransaction ? (
                                            <GatewayProvider
                                                wallet={{
                                                publicKey:
                                                    wallet.publicKey ||
                                                    new PublicKey(CANDY_MACHINE_PROGRAM),
                                                //@ts-ignore
                                                signTransaction: wallet.signTransaction,
                                                }}
                                                gatekeeperNetwork={
                                                candyMachine?.state?.gatekeeper?.gatekeeperNetwork
                                                }
                                                clusterUrl={rpcUrl}
                                                cluster={cluster}
                                                options={{ autoShowModal: false }}
                                            >
                                                <MintButton
                                                    candyMachine={candyMachine}
                                                    isMinting={isMinting}
                                                    isActive={isActive}
                                                    isEnded={isEnded}
                                                    isSoldOut={isSoldOut}
                                                    onMint={onMint}
                                                />
                                            </GatewayProvider>
                                        ) : (
                                            <MintButton
                                                candyMachine={candyMachine}
                                                isMinting={isMinting}
                                                isActive={isActive}
                                                isEnded={isEnded}
                                                isSoldOut={isSoldOut}
                                                onMint={onMint}
                                            />

                                        ) :
                                        <h1>Mint is private.</h1>
                                )}
                            </MintButtonContainer>
                            <br/>
                            {wallet && isActive && solanaExplorerLink &&
                              <SolExplorerLink href={solanaExplorerLink} target="_blank">View on
                                Solscan</SolExplorerLink>}
                        </NFT>
                    </DesContainer>
                </MintContainer>
            </MainContainer> */}
      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

export default Home;
