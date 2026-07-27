import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import {
  getAccountCountry,
  readAccountCountry,
  writeAccountCountry,
  type AccountCountry,
  type AccountCountryCode,
} from '@/lib/accountLocale';
import { getPrivyAppId } from '@/lib/wallet/mpc';

interface AccountContextValue {
  configured: boolean;
  ready: boolean;
  authenticated: boolean;
  accountId: string | null;
  displayName: string;
  getAccessToken: () => Promise<string | null>;
  country: AccountCountry;
  setCountry: (country: AccountCountryCode) => void;
  login: () => void;
  createAccount: () => void;
  logout: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | null>(null);

interface AccountBridgeProps {
  country: AccountCountry;
  setCountry: (country: AccountCountryCode) => void;
  children: React.ReactNode;
}

function AccountBridge({ country, setCountry, children }: AccountBridgeProps) {
  const { ready, authenticated, user, login, logout, getAccessToken } = usePrivy();
  const displayName = user?.email?.address ?? user?.phone?.number ?? 'Baraza member';
  const accountId = user?.wallet?.address ?? user?.id ?? null;

  const value = useMemo<AccountContextValue>(() => ({
    configured: true,
    ready,
    authenticated,
    accountId,
    displayName,
    getAccessToken,
    country,
    setCountry,
    login: () => login({ loginMethods: ['email', 'sms'] }),
    createAccount: () => login({ loginMethods: ['email', 'sms'] }),
    logout,
  }), [accountId, authenticated, country, displayName, getAccessToken, login, logout, ready, setCountry]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const appId = getPrivyAppId();
  const [countryCode, setCountryCode] = useState<AccountCountryCode>(() => readAccountCountry());
  const country = getAccountCountry(countryCode);
  const setCountry = useCallback((nextCountry: AccountCountryCode) => {
    writeAccountCountry(nextCountry);
    setCountryCode(nextCountry);
  }, []);

  if (!appId) {
    return (
      <AccountContext.Provider value={{
        configured: false,
        ready: true,
        authenticated: false,
        accountId: null,
        displayName: 'Baraza member',
        getAccessToken: async () => null,
        country,
        setCountry,
        login: () => undefined,
        createAccount: () => undefined,
        logout: async () => undefined,
      }}>
        {children}
      </AccountContext.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email', 'sms'],
        intl: { defaultCountry: country.code },
        appearance: {
          theme: 'dark',
          accentColor: '#f97316',
          landingHeader: 'Welcome to Baraza',
          loginMessage: 'Use your phone number or email to continue.',
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'off' },
          solana: { createOnLogin: 'users-without-wallets' },
          showWalletUIs: false,
        },
      }}
    >
      <AccountBridge country={country} setCountry={setCountry}>
        {children}
      </AccountBridge>
    </PrivyProvider>
  );
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount must be used inside AccountProvider');
  return value;
}
