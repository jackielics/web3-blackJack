import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { verifyMessage } from "viem"
import jwt from "jsonwebtoken"


const client = new DynamoDBClient({
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_USER_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_USER_ACCESS_KEY || ""
    }
});

const docClient = DynamoDBDocumentClient.from(client)

const TABLE_NAME = "blackJack"

// 写入到数据库
async function writeScore(player: string, score: number): Promise<void>{
    const params = {
        TableName: TABLE_NAME,
        Item:{
            player: player,
            score: score
        }
    };
    try{
        await docClient.send(new PutCommand(params));
        console.log(`Successfully wrote score ${score} to player ${player}`)
    }catch (error){
        console.error(`Error writing to DynamoDB: ${error}`)
        throw error
    }
}

async function readScore(player: string): Promise<number | null>{
    const params = {
        TableName: TABLE_NAME,
        Key:{
            player: player,
        }
    };

    try{
        const result = await docClient.send(new GetCommand(params))
        if (result.Item){
                console.log(`Score for Player ${player}: ${result.Item.score}`);
                return result.Item.score as number
        }else{
            console.log(`No Score Found for player ${player}`)
            return null
        }
    }catch(error){
        console.error(`Error reading from DynamoDB: ${error}`)
        throw error
    }
}

// when the game starts, get player and dealer 2 random cards respectively

import { Gaegu, Palette_Mosaic } from "next/font/google";
import { stat } from "fs";

export interface Card {
  suit: string;
  rank: string;
}

const suits = ["♠️", "♥️", "♦️", "♣️"];
const ranks = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const initialDeck = suits
  .map((suit) => ranks.map((rank) => ({ suit: suit, rank: rank })))
  .flat();

const gameState: {
  playerHand: Card[];
  dealerHand: Card[];
  deck: Card[];
  message: string;
  score: number;
} = {
  playerHand: [],
  dealerHand: [],
  deck: initialDeck,
  message: "",
  score: 0,
};

function getRandomCards(deck: Card[], count: number) {
  const randomIndexSet = new Set<Number>();
  while (randomIndexSet.size < count) {
    randomIndexSet.add(Math.floor(Math.random() * deck.length));
  }
  const randomCards = deck.filter((_, index) => randomIndexSet.has(index));
  const remainingDeck = deck.filter((_, index) => !randomIndexSet.has(index));
  return [randomCards, remainingDeck];
}

export async function GET(request: Request) {
    const url = new URL(request.url)
    const address = url.searchParams.get("address")
    if(!address){
        return new Response(JSON.stringify({message: "address is required"}), {status: 400})
    }

  // reset the game state
  gameState.playerHand = [];
  gameState.dealerHand = [];
  gameState.deck = initialDeck;
  gameState.message = "";

  const [playerCards, remainingDeck] = getRandomCards(gameState.deck, 2);
  const [dealerCards, newDeck] = getRandomCards(remainingDeck, 2);

  gameState.playerHand = playerCards;
  gameState.dealerHand = dealerCards;
  gameState.deck = newDeck;
  gameState.message = "";

  try{
    const data = await readScore(address)
    if(!data){
        gameState.score = 0
    }else{
        gameState.score = data
    }

  }catch(error){
    console.error(`Error Initializing game state ${error}`)
    return new Response(
        JSON.stringify({ message : "error fetching data from dynamoDB"}),
        {status: 500});
  }


  return new Response(
    JSON.stringify({
      playerHand: gameState.playerHand,
      dealerHand: [gameState.dealerHand[0], { rank: "?", suit: "?" } as Card],
      message: "",
      score: gameState.score,
    }),
    {
      status: 200,
    }
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const { action, address } = body;

  if (action === 'auth'){
    const {address, message, signature} = body
    const isValid = await verifyMessage({ address, message, signature });
    if(!isValid){
        return new Response(JSON.stringify({message: "Invalid Signature"}), {status: 400})
    }else{
        const token = jwt.sign({address}, process.env.JWT_SECRET || "", {expiresIn: "1h"})
        return new Response(JSON.stringify({ message: "Valid Signature" ,
            jsonwebtoken: token
        }), {
          status: 200,
        });
    }
  }

  // check is the token is valid
  const token = request.headers.get("bearer")?.split(" ")[1]
  if(!token){
    return new Response(JSON.stringify({message: "Token is required"}), {status: 401})
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET||"") as {address: string}
  if (decoded.address.toLocaleLowerCase() != address.toLocaleLowerCase()){
    return new Response(JSON.stringify({ message: "Invalid token" }), {
      status: 401,
    });
  }
    if (action === "hit") {
      // when the hit is clicked, get a random card from the deck and add it to the player hand:
      // if the player hand is greater than 21, the player loses(bust);
      // if the player hand is less than 21, the player can continue to hit or stand;
      // if the player hand is equal to 21, the player wins;

      const [cards, newDeck] = getRandomCards(gameState.deck, 1);
      gameState.playerHand.push(...cards);
      gameState.deck = newDeck;

      const playerHandValue = calculateHandValue(gameState.playerHand);
      if (playerHandValue === 21) {
        gameState.message = "Black Jack! Player wins";
        gameState.score += 100;
      } else if (playerHandValue > 21) {
        gameState.message = "Bust! Player loses!";
        gameState.score -= 100;
      }
    } else if (action === "stand") {
      // when the stand is clicked, the dealer will draw cards until the dealer hand is greater than or equal to 17;
      // if the dealer hand is greater than 21, the player wins, the dealer busts;
      // else if the dealer hand is greater than the player hand, the dealer wins;
      // else if the dealer hand is less than the player hand, the player wins;
      // if the dealer hand is equal to the player hand, it's a tie;

      while (calculateHandValue(gameState.dealerHand) < 17) {
        const [randomCards, newDeck] = getRandomCards(gameState.deck, 1);
        gameState.deck = newDeck;
        gameState.dealerHand.push(...randomCards);
      }
      const dealerHandValue = calculateHandValue(gameState.dealerHand);
      if (dealerHandValue > 21) {
        gameState.message = "Dealer Bust! Player Wins!";
        gameState.score += 100;
      } else if (dealerHandValue === 21) {
        gameState.message = "Dealer Black Jack! Player Loses!";
        gameState.score -= 100;
      } else {
        const playerHandValue = calculateHandValue(gameState.playerHand);
        if (playerHandValue > dealerHandValue) {
          gameState.message = "Player Wins!";
          gameState.score += 100;
        } else if (playerHandValue > dealerHandValue) {
          gameState.message = "Player Loses";
          gameState.score -= 100;
        } else {
          gameState.message = "Draw";
        }
      }
    } else {
      return new Response(JSON.stringify({ message: "Invalid action" }), {
        status: 400,
      });
    }
  //  写入数据库
  try {
    await writeScore(address, gameState.score);
  } catch (error) {
    console.error(`Error writing to DynamoDB`, error);
    return new Response(
      JSON.stringify({ message: "error writing data to dynamoDB" }),
      { status: 500 }
    );
  }

  return new Response(
    JSON.stringify({
      playerHand: gameState.playerHand,
      dealerHand:
        gameState.message === ""
          ? [gameState.dealerHand[0], { rank: "?", suit: "?" } as Card]
          : gameState.dealerHand,
      message: gameState.message,
      score: gameState.score,
    }),
    { status: 200 }
  );
}

function calculateHandValue(hand: Card[]) {
  let value = 0;
  let aceCount = 0;
  hand.forEach((card) => {
    if (card.rank === "A") {
      value += 11;
      aceCount++;
    } else if (["J", "Q", " K"].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
    while (value >= 21 && aceCount > 0) {
      value -= 10;
      aceCount--;
    }
  });
  return value;
}
