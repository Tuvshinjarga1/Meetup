"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";

export default function VerifyEmail() {
  const { user, verifyEmail, logout } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (countdown > 0 && !canResend) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !canResend) {
      setCanResend(true);
    }
  }, [countdown, canResend]);

  const handleResendEmail = async () => {
    setError("");
    setSuccess(false);

    try {
      setIsResending(true);
      await verifyEmail();
      setSuccess(true);
      setCanResend(false);
      setCountdown(60);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Баталгаажуулах и-мэйл илгээхэд алдаа гарлаа");
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Error logging out:", err);
    }
  };

  return (
    <div className="container max-w-md py-10">
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-center">
            И-мэйл баталгаажуулах
          </CardTitle>
          <CardDescription className="text-center">
            {user?.email} хаяг руу баталгаажуулах холбоос илгээлээ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert
              variant="default"
              className="bg-green-50 border-green-200 text-green-800"
            >
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Баталгаажуулах и-мэйлийг дахин илгээлээ. И-мэйлээ шалгана уу.
              </AlertDescription>
            </Alert>
          )}

          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              И-мэйл хаягаа баталгаажуулахын тулд илгээсэн холбоос дээр дарна
              уу. Хэрэв и-мэйл ирээгүй бол спам хавтсаа шалгана уу.
            </p>

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleResendEmail}
                disabled={isResending || !canResend}
              >
                {isResending
                  ? "Илгээж байна..."
                  : canResend
                  ? "Дахин илгээх"
                  : `Дахин илгээх (${countdown}с)`}
              </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col">
          <div className="text-center text-sm">
            <Button variant="link" onClick={handleLogout}>
              <a href="/auth/login">Нэвтрэх хуудас руу буцах</a>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
