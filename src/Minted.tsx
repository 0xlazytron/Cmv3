import { useCallback, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import fb from "./img/icons/fb.svg";
import down from "./img/icons/downarr.svg";
import insta from "./img/icons/insta.svg";
import lin from "./img/icons/lin.svg";
import yt from "./img/icons/yt.svg";
import twt from "./img/icons/twitter.svg";
import aw from "./img/09-6-300x300.png";
import * as anchor from "@project-serum/anchor";
import { Commitment, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { Snackbar } from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";
import { AlertState, getAtaForMint, toDate } from "./utils";
import {
  CandyMachineAccount,
  getCandyMachineState,
  getCollectionPDA,
  SetupState,
} from "./candy-machine";

import { getParsedNftAccountsByOwner } from "@nfteyez/sol-rayz";

const cluster = process.env.REACT_APP_SOLANA_NETWORK!.toString();
const decimals = process.env.REACT_APP_SPL_TOKEN_TO_MINT_DECIMALS
  ? +process.env.REACT_APP_SPL_TOKEN_TO_MINT_DECIMALS!.toString()
  : 9;
const splTokenName = process.env.REACT_APP_SPL_TOKEN_TO_MINT_NAME
  ? process.env.REACT_APP_SPL_TOKEN_TO_MINT_NAME.toString()
  : "TOKEN";

export interface HomeProps {
  candyMachineId?: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  txTimeout: number;
  rpcHost: string;
  network: WalletAdapterNetwork;
}

const Minted = (props: HomeProps) => {
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
  const [collectibles, setCollectibles] = useState(Array<any>);
  const [firstCollectible, setFirstCollectible] = useState<any>();

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [needTxnSplit, setNeedTxnSplit] = useState(true);
  const [setupTxn, setSetupTxn] = useState<SetupState>();

  const wallet = useWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachineAccount>();

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

  function throwConfetti(): void {
    confetti({
      particleCount: 400,
      spread: 70,
      origin: { y: 0.6 },
    });
  }

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

  useEffect(() => {
    getToken();
  }, []);

  async function getToken() {
    if (typeof window.solana !== "undefined") {
      const solana_connection = await window.solana.connect();
      try {
        const nfts = await getParsedNftAccountsByOwner({
          publicAddress: solana_connection!.publicKey.toString(),
          connection: props.connection,
          sanitize: true,
        });
        const first_nft = nfts[0].data;
        const uri = first_nft.uri;
        const metadata = await fetch(uri).then((res) => res.json());
        setFirstCollectible(metadata);
        setCollectibles(nfts);
      } catch (error) {
        console.log(error);
      }
    }
  }

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
                href="#!"
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
                  <div className="post-entry post-entry-type-page post-entry-8899">
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
                                  src={firstCollectible?.image ?? aw}
                                  alt=""
                                  title={
                                    firstCollectible?.name ?? "Domein Bergen"
                                  }
                                  height="289"
                                  width="300"
                                />
                              </div>
                            </div>
                          </div>
                          <section className="av_textblock_section">
                            <div className="avia_textblock">
                              <p style={{ textAlign: "center", color: "#000" }}>
                                <a
                                  target={"_blank"}
                                  href={firstCollectible?.external_url ?? "#!"}
                                  rel="noreferrer"
                                >
                                  Click here for a photo
                                </a>
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
                              Your Grapevine NFTree!
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
                                <p
                                  style={{
                                    textAlign: "center",
                                    color: "#53632e",
                                  }}
                                >
                                  This NFT is a proof of a lifetime ownership to
                                  a specific grapevine on Dutch organic
                                  vineyard: Domein Bergen. This NFT entitles you
                                  to an equivalent share of the vineyard&rsquo;s
                                  bottled yields.
                                </p>
                              </em>
                            </div>
                          </section>
                          <div className=" avia-button-center">
                            <a
                              className="avia-button-center  avia-size-small avia-position-center"
                              href="https://opensea.io/es/collection/grapevine-nftree"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Opensea
                            </a>
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
                    rel="noopener noreferrer"
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
                    rel="noopener noreferrer"
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
                    rel="noopener noreferrer"
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
                    rel="noopener noreferrer"
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
                    rel="noopener noreferrer"
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

export default Minted;
