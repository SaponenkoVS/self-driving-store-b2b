"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"

import Register from "@modules/account/components/register"
import Login from "@modules/account/components/login"
import TradeRegister from "@modules/account/components/trade-register"

export enum LOGIN_VIEW {
  SIGN_IN = "sign-in",
  REGISTER = "register",
  TRADE_REGISTER = "trade-register",
}

const LoginTemplate = () => {
  const searchParams = useSearchParams()
  const [currentView, setCurrentView] = useState<string>(
    searchParams.get("view") === LOGIN_VIEW.TRADE_REGISTER ? LOGIN_VIEW.TRADE_REGISTER : "sign-in"
  )

  return (
    <div className="w-full flex justify-start px-8 py-8">
      {currentView === "sign-in" ? (
        <Login setCurrentView={setCurrentView} />
      ) : currentView === LOGIN_VIEW.TRADE_REGISTER ? (
        <TradeRegister setCurrentView={setCurrentView} />
      ) : (
        <Register setCurrentView={setCurrentView} />
      )}
    </div>
  )
}

export default LoginTemplate
