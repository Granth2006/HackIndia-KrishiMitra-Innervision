import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  generateWalletFromEmail,
  createBlockchainRecord,
  getBlockchainRecordCount,
  getTokenBalance,
  awardTokens as awardTokensFn,
  spendTokens as spendTokensFn,
} from "../lib/blockchain";

const BlockchainContext = createContext(null);

export function BlockchainProvider({ children }) {
  const { user } = useAuth();
  const [walletAddress, setWalletAddress] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastReward, setLastReward] = useState(null); // { amount, reason }

  // Initialize wallet when user logs in
  useEffect(() => {
    if (user?.email && !user.isGuest) {
      generateWalletFromEmail(user.email).then((addr) => {
        setWalletAddress(addr);
      });
    } else {
      setWalletAddress(null);
      setTokenBalance(0);
      setRecordCount(0);
      setLoading(false);
    }
  }, [user?.email, user?.isGuest]);

  // Fetch balance + record count when wallet is ready
  useEffect(() => {
    if (!walletAddress || !user?.dbId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const [balRes, countRes] = await Promise.all([
        getTokenBalance(user.dbId),
        getBlockchainRecordCount(user.dbId),
      ]);
      setTokenBalance(balRes.balance);
      setRecordCount(countRes.count);
      setLoading(false);
    };

    fetchData();
  }, [walletAddress, user?.dbId]);

  const refreshBalance = useCallback(async () => {
    if (!user?.dbId) return;
    const { balance } = await getTokenBalance(user.dbId);
    setTokenBalance(balance);
    const { count } = await getBlockchainRecordCount(user.dbId);
    setRecordCount(count);
  }, [user?.dbId]);

  const addRecord = useCallback(
    async (recordType, data) => {
      if (!user?.dbId || !walletAddress) return null;
      const result = await createBlockchainRecord(user.dbId, recordType, data, walletAddress);
      if (!result.error) {
        setRecordCount((c) => c + 1);
      }
      return result;
    },
    [user?.dbId, walletAddress]
  );

  const awardTokens = useCallback(
    async (amount, reason) => {
      if (!user?.dbId) return null;
      const result = await awardTokensFn(user.dbId, amount, reason);
      if (!result.error) {
        setTokenBalance(result.newBalance);
        setLastReward({ amount, reason });
        // Auto-clear reward notification after 4 seconds
        setTimeout(() => setLastReward(null), 4000);
      }
      return result;
    },
    [user?.dbId]
  );

  const spendTokens = useCallback(
    async (amount, purpose) => {
      if (!user?.dbId) return null;
      const result = await spendTokensFn(user.dbId, amount, purpose);
      if (!result.error) {
        setTokenBalance(result.newBalance);
      }
      return result;
    },
    [user?.dbId]
  );

  return (
    <BlockchainContext.Provider
      value={{
        walletAddress,
        tokenBalance,
        recordCount,
        loading,
        lastReward,
        refreshBalance,
        addRecord,
        awardTokens,
        spendTokens,
      }}
    >
      {children}
    </BlockchainContext.Provider>
  );
}

export const useBlockchain = () => useContext(BlockchainContext);
