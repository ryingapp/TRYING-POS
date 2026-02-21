import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Link } from "wouter";

export default function NotFound() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-not-found">
              404 - {t("pageNotFound")}
            </h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            {t("pageNotFoundDesc")}
          </p>

          <Link href="/">
            <Button className="mt-4 w-full" data-testid="button-go-home">
              {t("goHome")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
