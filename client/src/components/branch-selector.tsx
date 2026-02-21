import { useState } from "react";
import { Building2, ChevronDown, MapPin, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useBranch } from "@/lib/branch";
import { useLanguage } from "@/lib/i18n";
import type { Branch } from "@shared/schema";

export function BranchSelector() {
  const { t, getLocalizedName } = useLanguage();
  const { branches, selectedBranch, selectedBranchId, setSelectedBranchId, isLoading } = useBranch();
  const [open, setOpen] = useState(false);

  const activeBranches = branches.filter((b) => b.isActive);

  if (isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Building2 className="h-4 w-4" />
        <span className="max-w-[120px] truncate">...</span>
      </Button>
    );
  }

  if (activeBranches.length === 0) {
    return null;
  }

  const handleSelectBranch = (branch: Branch) => {
    setSelectedBranchId(branch.id);
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        data-testid="button-branch-selector"
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[150px] truncate">
          {selectedBranch 
            ? getLocalizedName(selectedBranch.name, selectedBranch.nameAr) 
            : t("selectBranch")}
        </span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("selectBranch")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {activeBranches.map((branch) => (
              <button
                key={branch.id}
                onClick={() => handleSelectBranch(branch)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors hover-elevate ${
                  selectedBranchId === branch.id
                    ? "border-primary bg-primary/5"
                    : "border-border"
                }`}
                data-testid={`button-select-branch-${branch.id}`}
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 text-start">
                  <div className="font-medium flex items-center gap-2">
                    {getLocalizedName(branch.name, branch.nameAr)}
                    {branch.isMain && (
                      <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-600">
                        <Crown className="h-3 w-3" />
                        {t("mainBranch") || "رئيسي"}
                      </Badge>
                    )}
                  </div>
                  {branch.address && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {branch.address}
                    </div>
                  )}
                </div>
                {selectedBranchId === branch.id && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
