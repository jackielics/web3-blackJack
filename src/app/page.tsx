"use client";
import { useEffect, useState } from "react";
import {ConnectButton} from "@rainbow-me/rainbowkit"
import {useAccount, useSignMessage} from "wagmi"


export default function Page() {
  const [winner, setWinner] = useState("")
  const [message, setMessage] = useState("")
  const [playerHand, setPlayerHand] = useState<{rank: string, suit: string}[]>([])
  const [dealerHand, setDealerHand] = useState<{rank: string, suit: string}[]>([])
  const [score, setScore] = useState(0)
  const {address, isConnected} = useAccount()
  const [isSigned, setIsSigned] = useState(false)
  const {signMessageAsync } = useSignMessage();

  const initGame = async () => {
    const response = await fetch(`/api?address=${address}`, { method: "GET" });
    const data = await response.json();
    setPlayerHand(data.playerHand);
    setDealerHand(data.dealerHand);
    setMessage(data.message);
    setScore(data.score);
  };


  async function handleHit(){
    const response = await fetch(`/api?address=${address}`, {
      method: "POST",
      headers: {
        bearer: `Bearer ${localStorage.getItem("jwt") || ""}`
      },
      body: JSON.stringify({ action: "hit", address }),
    });
    const data = await response.json()
    setPlayerHand(data.playerHand)
    setDealerHand(data.dealerHand)
    setMessage(data.message)
    setScore(data.score)
  }

  async function handleStand() {
    const response = await fetch(`/api?address=${address}`, {
      method: "POST",
      headers: {
        bearer: `Bearer ${localStorage.getItem("jwt") || ""}`,
      },
      body: JSON.stringify({ action: "hit", address }),
    });
    const data = await response.json()
    setPlayerHand(data.playerHand)
    setDealerHand(data.dealerHand)
    setMessage(data.message)
    setScore(data.score)
  }

  async function handleReset() {
    const response = await fetch(`/api?address=${address}`, { method: "GET" });
    const data = await response.json()
    setPlayerHand(data.playerHand)
    setDealerHand(data.dealerHand)
    setMessage(data.message)
    setScore(data.score)
  }

  async function handleSign() {
    const message = `Welcome to the game Black Jack at ${new Date().toString()}`
    const signature = await signMessageAsync({ message });
    const response = await fetch("/api", {
      method: "POST",
      body: JSON.stringify({ 
        action: "auth",
        address,
        message,
        signature
      }),
    });
    if (response.status === 200){
      const jsonwebtoken = await response.json()
      localStorage.setItem('jwt', jsonwebtoken)
      setIsSigned(true)
      initGame()
    }
  }


if(!isSigned){
  return(
    <div className="flex flex-col items-center h-screen bg-gray-400">
      <ConnectButton />
      <button onClick={handleSign} className="border-black bg-amber-300 rounded-md"> Sign with your wallet </button>
    </div>
  )
}


  return (
    <div className="flex flex-col items-center h-screen bg-gray-400">
      <ConnectButton />
      <h1 className="my-4 text-4xl bold">Welcome the black jack game!!</h1>
      <h2
        className={`my-4 text-2xl bold
        ${winner === "player" ? "bg-green-500" : "bg-yellow-500"}`}
      >
        Score: {score} {message}
      </h2>
      <div>
        Dealer's hand:
        <div className="flex flex-row gap-2">
          {dealerHand.length === 0 ? (
            <></>
          ) : (
            dealerHand.map((card, index) => (
              <div
                className="h-42 w-28 border-black border-1 flex flex-col justify-between rounded-sm bg-white"
                key={index}
              >
                <h2 className="self-start text-2xl pt-3 pl-3">{card.rank}</h2>
                <h2 className="self-center text-3xl">{card.suit}</h2>
                <h2 className="self-end text-2xl pb-3 pr-3">{card.rank}</h2>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        Player's hand:
        <div className="flex flex-row gap-2">
          {playerHand.length === 0 ? (
            <></>
          ) : (
            playerHand.map((card, index) => (
              <div
                className="h-42 w-28 border-black border-1 flex flex-col justify-between rounded-sm bg-white"
                key={index}
              >
                <h2 className="self-start text-2xl pt-3 pl-3">{card.rank}</h2>
                <h2 className="self-center text-3xl">{card.suit}</h2>
                <h2 className="self-end text-2xl pb-3 pr-3">{card.rank}</h2>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-row gap-2 mt-4">
        {message === "" ? (
          <>
            <button onClick={handleHit} className="p-1 bg-amber-300 rounded-lg">
              {" "}
              Hit{" "}
            </button>
            <button
              onClick={handleStand}
              className="p-1 bg-amber-300 rounded-lg"
            >
              {" "}
              Stand{" "}
            </button>
          </>
        ) : (
          <button onClick={handleReset} className="p-1 bg-amber-300 rounded-lg">
            {" "}
            Reset{" "}
          </button>
        )}
      </div>
    </div>
  );
}
