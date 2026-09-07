import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Download,
  Upload,
  Database,
  Eye,
  EyeOff,
  Image,
  Power,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { CloudflareTunnelSettings } from "@/components/CloudflareTunnelSettings";
import { Header } from "@/components/Header";
import {
  compactDatabasePath,
  getErrorMessage,
  verifyDashboardPassword,
} from "@/lib/api";
import { RippleButton } from "@/components/animate/ripple-button";
import { FlipButton } from "@/components/animate/flip-button";
import { Frame, FrameHeader, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  formToSettingsPartial,
  settingsToForm,
  type SettingsForm,
} from "@/lib/admin-extras-api";
import {
  fetchDatabasePath,
  fetchSettings,
  shutdownRouter,
  updateSettings,
  type AppSettings,
} from "@/lib/settings-api";
import { downloadBackup, restoreBackup } from "@/lib/backup-api";
import { probeEnabled } from "@/lib/live-mode";
import { toast } from "@/components/ui/toast";

const CAVEMAN_LEVELS = [
  { value: "lite", label: "Lite" },
  { value: "full", label: "Full" },
  { value: "ultra", label: "Ultra" },
  { value: "wenyan-lite", label: "Wenyan lite" },
  { value: "wenyan", label: "Wenyan" },
  { value: "wenyan-ultra", label: "Wenyan ultra" },
];

const PONYTAIL_LEVELS = [
  { value: "lite", label: "Lite" },
  { value: "full", label: "Full" },
  { value: "ultra", label: "Ultra" },
];

function levelLabel(options: { value: string; label: string }[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ProfilePhotoCropDialog({
  open,
  imageSrc,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  imageSrc: string;
  onOpenChange: (open: boolean) => void;
  onApply: (dataUrl: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [viewportSize, setViewportSize] = useState(320);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setImageSize({ width: 0, height: 0 });
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open || !viewportRef.current) return;
    const viewport = viewportRef.current;
    const updateSize = () => setViewportSize(Math.max(1, viewport.clientWidth));
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [open]);

  const fitScale = imageSize.width && imageSize.height
    ? viewportSize / Math.min(imageSize.width, imageSize.height)
    : 1;
  const displayScale = fitScale * zoom;
  const displayWidth = imageSize.width * displayScale;
  const displayHeight = imageSize.height * displayScale;
  const maxOffsetX = Math.max(0, (displayWidth - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (displayHeight - viewportSize) / 2);

  useEffect(() => {
    setOffset((current) => ({
      x: clamp(current.x, -maxOffsetX, maxOffsetX),
      y: clamp(current.y, -maxOffsetY, maxOffsetY),
    }));
  }, [maxOffsetX, maxOffsetY]);

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    setImageSize({
      width: event.currentTarget.naturalWidth,
      height: event.currentTarget.naturalHeight,
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!imageSize.width || !imageSize.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: clamp(drag.originX + event.clientX - drag.startX, -maxOffsetX, maxOffsetX),
      y: clamp(drag.originY + event.clientY - drag.startY, -maxOffsetY, maxOffsetY),
    });
  }

  function finishPointer(event: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function applyCrop() {
    const image = imageRef.current;
    if (!image || !imageSize.width || !imageSize.height || !displayScale) return;

    const sourceCropSize = viewportSize / displayScale;
    const sourceX = clamp(
      imageSize.width / 2 - sourceCropSize / 2 - offset.x / displayScale,
      0,
      imageSize.width - sourceCropSize,
    );
    const sourceY = clamp(
      imageSize.height / 2 - sourceCropSize / 2 - offset.y / displayScale,
      0,
      imageSize.height - sourceCropSize,
    );
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 384;
    const context = canvas.getContext("2d");
    if (!context) {
      toast.error("Unable to crop profile photo");
      return;
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceCropSize,
      sourceCropSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    if (dataUrl.length > 512 * 1024) {
      toast.error("Cropped profile photo is still too large");
      return;
    }
    onApply(dataUrl);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust profile photo</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div
            ref={viewportRef}
            role="img"
            aria-label="Profile photo crop preview"
            className="relative mx-auto aspect-square w-full max-w-[360px] cursor-grab touch-none overflow-hidden rounded-2xl border border-border bg-muted active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finishPointer}
            onPointerCancel={finishPointer}
          >
            {imageSrc ? (
              <img
                ref={imageRef}
                src={imageSrc}
                alt=""
                draggable={false}
                onLoad={onImageLoad}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{
                  width: displayWidth || "100%",
                  height: displayHeight || "100%",
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15" />
          </div>

          <div className="mx-auto w-full max-w-[360px] space-y-2">
            <div className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3">
              <div className="flex min-w-0 items-center justify-center gap-2">
                <ZoomOut className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  aria-label="Photo zoom"
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-primary"
                />
                <ZoomIn className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                {Math.round(zoom * 100)}%
              </span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                <RotateCcw className="size-3" />
                Reset
              </button>
            </div>
          </div>
        </DialogPanel>
        <DialogFooter>
          <RippleButton variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </RippleButton>
          <RippleButton
            onClick={applyCrop}
            disabled={!imageSize.width || !imageSize.height}
          >
            Use photo
          </RippleButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <FlipButton
        active={active}
        onToggle={onToggle}
        activeLabel=""
        inactiveLabel=""
      />
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  hint,
  autoComplete,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  hint?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className="pr-10"
        />
        <button
          type="button"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {hint ? <span className="block text-[11px] text-muted-foreground/80">{hint}</span> : null}
    </label>
  );
}

function ChangePasswordDialog({
  open,
  onOpenChange,
  hasPassword,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPassword: boolean;
  onChanged: () => Promise<void>;
}) {
  const [step, setStep] = useState<"verify" | "new">(hasPassword ? "verify" : "new");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(hasPassword ? "verify" : "new");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setBusy(false);
  }, [open, hasPassword]);

  function close() {
    if (busy) return;
    onOpenChange(false);
  }

  async function verifyCurrentPassword() {
    if (!currentPassword) {
      setError("Enter your current password to continue.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await verifyDashboardPassword(currentPassword);
      setStep("new");
    } catch (err) {
      setError(getErrorMessage(err, "Unable to verify current password"));
    } finally {
      setBusy(false);
    }
  }

  async function saveNewPassword() {
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updateSettings({
        newPassword,
        ...(hasPassword ? { currentPassword } : {}),
      });
      await onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to change dashboard password"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "verify") await verifyCurrentPassword();
    else await saveNewPassword();
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {step === "verify" ? "Verify current password" : "Set a new dashboard password"}
            </DialogTitle>
            <DialogDescription>
              {step === "verify"
                ? "Confirm your current password before choosing a replacement."
                : "Choose a password with at least 6 characters, then confirm it below."}
            </DialogDescription>
          </DialogHeader>

          <DialogPanel className="space-y-4">
            {step === "verify" ? (
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            ) : (
              <>
                <div className="rounded-lg border border-success/25 bg-success/8 px-3 py-2 text-xs text-success">
                  Current password verified. You can now set a new one.
                </div>
                <PasswordField
                  label="New dashboard password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  hint="At least 6 characters"
                  autoComplete="new-password"
                  autoFocus
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </>
            )}
            {error ? (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </DialogPanel>

          <DialogFooter>
            {step === "new" && hasPassword ? (
              <RippleButton
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("verify");
                  setError(null);
                }}
                disabled={busy}
              >
                Back
              </RippleButton>
            ) : (
              <RippleButton type="button" variant="outline" onClick={close} disabled={busy}>
                Cancel
              </RippleButton>
            )}
            <RippleButton type="submit" disabled={busy}>
              {busy ? (step === "verify" ? "Checking…" : "Updating…") : step === "verify" ? "Continue" : "Change password"}
            </RippleButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BackupPasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  busy: boolean;
  onConfirm: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");

  useEffect(() => {
    setPassword("");
  }, [open]);

  function close() {
    if (busy) return;
    setPassword("");
    onOpenChange(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim() || busy) return;
    await onConfirm(password);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <PasswordField
              label="Dashboard password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </DialogPanel>
          <DialogFooter>
            <RippleButton type="button" variant="outline" onClick={close} disabled={busy}>
              Cancel
            </RippleButton>
            <RippleButton type="submit" disabled={busy || !password.trim()}>
              {busy ? "Working…" : "Continue"}
            </RippleButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShutdownDialog({
  open,
  onOpenChange,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onConfirm: () => Promise<void>;
}) {
  function close() {
    if (!busy) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shut down Swoosh Router?</DialogTitle>
          <DialogDescription>
            The router will stop accepting new requests and gracefully drain active work before the process exits.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel className="space-y-3">
          <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive-foreground">
            You will need to start the router again from its service manager or terminal. This does not delete settings, providers, or usage data.
          </div>
        </DialogPanel>
        <DialogFooter>
          <RippleButton type="button" variant="outline" onClick={close} disabled={busy}>
            Cancel
          </RippleButton>
          <RippleButton
            type="button"
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            <Power />
            {busy ? "Shutting down…" : "Shut down router"}
          </RippleButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const requestedTab = searchParams.get("tab");
    return requestedTab === "preferences" || requestedTab === "security" || requestedTab === "data"
      ? requestedTab
      : "preferences";
  });
  const [form, setForm] = useState<SettingsForm>(() =>
    settingsToForm({
      requireApiKey: true,
      requireLogin: true,
      hasPassword: true,
      providerStrategies: {},
      providerThinking: {},
      rtkEnabled: true,
      cavemanEnabled: false,
      cavemanLevel: "full",
      ponytailEnabled: false,
      ponytailLevel: "full",
    })
  );
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [shutdownDialogOpen, setShutdownDialogOpen] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [profileCropOpen, setProfileCropOpen] = useState(false);
  const [pendingProfilePhoto, setPendingProfilePhoto] = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const formRef = useRef(form);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const autoSaveRevisionRef = useRef(0);

  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
    enabled: probeEnabled(),
    retry: false,
  });
  const databasePathQ = useQuery({
    queryKey: ["settings", "database-path"],
    queryFn: fetchDatabasePath,
    enabled: probeEnabled() && activeTab === "data",
    retry: false,
  });

  useEffect(() => {
    if (settingsQ.data) {
      const nextForm = settingsToForm(settingsQ.data);
      formRef.current = nextForm;
      setForm(nextForm);
    }
  }, [settingsQ.data]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const loading = settingsQ.isLoading;

  function scheduleAutoSave(settingsPartial: Partial<AppSettings>) {
    const revision = ++autoSaveRevisionRef.current;
    setAutoSaveStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      autoSaveChainRef.current = autoSaveChainRef.current
        .catch(() => {})
        .then(async () => {
          await updateSettings(settingsPartial);
          qc.setQueryData(["settings"], (current: AppSettings | undefined) =>
            current ? { ...current, ...settingsPartial } : current,
          );
          if (Object.prototype.hasOwnProperty.call(settingsPartial, "currency")) {
            await qc.invalidateQueries({ queryKey: ["currency-settings"] });
          }
          if (revision === autoSaveRevisionRef.current) {
            setAutoSaveStatus("saved");
          }
        })
        .catch((err) => {
          if (revision !== autoSaveRevisionRef.current) return;
          setAutoSaveStatus("error");
          toast.error(getErrorMessage(err, "Automatic save failed"));
        });
    }, 300);
  }

  function set<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    const nextValue = key === "profileName" && typeof value === "string"
      ? value.trim().replace(/\s+/g, " ").slice(0, 40) || "Swoosh"
      : value;
    const nextForm = { ...formRef.current, [key]: nextValue };
    formRef.current = nextForm;
    setForm(nextForm);
    const isPreference = key === "profileName" || key === "profileAvatar" || key === "currency";
    scheduleAutoSave(
      isPreference
        ? ({ [key]: nextValue } as Partial<AppSettings>)
        : formToSettingsPartial(nextForm),
    );
  }

  function onProfilePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if (!allowedTypes.has(file.type)) {
      toast.error("Profile photo must be PNG, JPG, WEBP, or GIF");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Profile photo must be 2 MB or smaller");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setPendingProfilePhoto(reader.result);
        setProfileCropOpen(true);
      }
    };
    reader.onerror = () => toast.error("Unable to read profile photo");
    reader.readAsDataURL(file);
  }

  function onProfileCropOpenChange(open: boolean) {
    setProfileCropOpen(open);
    if (!open) setPendingProfilePhoto(null);
  }

  function onProfileCropApply(dataUrl: string) {
    set("profileAvatar", dataUrl);
    setProfileCropOpen(false);
    setPendingProfilePhoto(null);
  }

  async function onShutdown() {
    setShuttingDown(true);
    try {
      const result = await shutdownRouter();
      if (result.success === false) {
        throw new Error(result.message || "Shutdown request was rejected");
      }
      setShutdownDialogOpen(false);
      toast.success("Shutdown initiated. The router is draining active requests.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Shutdown failed"));
      setShuttingDown(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Header title="Settings" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Header
        title="Settings"
      />

      <Tabs value={activeTab} className="gap-2" onValueChange={(v) => setActiveTab(v)}>
        <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
          <TabsList className="w-fit max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>
          <div
            className="min-h-4 text-right text-xs text-muted-foreground"
            aria-live="polite"
          >
            {autoSaveStatus === "saving"
              ? "Saving changes…"
              : autoSaveStatus === "saved"
                ? "All changes saved"
                : autoSaveStatus === "error"
                  ? <span className="text-destructive">Automatic save failed</span>
                  : null}
          </div>
        </div>

        <TabsContent value="general" className="space-y-3">
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium text-muted-foreground">
              Token saver
            </p>
            <ToggleRow
              label="RTK"
              active={form.rtkEnabled}
              onToggle={() => set("rtkEnabled", !form.rtkEnabled)}
            />
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Caveman</p>
                </div>
                <FlipButton
                  active={form.cavemanEnabled}
                  onToggle={() =>
                    set("cavemanEnabled", !form.cavemanEnabled)
                  }
                  activeLabel=""
                  inactiveLabel=""
                />
              </div>
              <div className="mt-3">
                <Select
                  value={form.cavemanLevel}
                  onValueChange={(v) =>
                    set("cavemanLevel", v ?? "full")
                  }
                  disabled={!form.cavemanEnabled}
                >
                  <SelectTrigger size="sm" className="w-full sm:w-44">
                    <span className="truncate">
                      {levelLabel(CAVEMAN_LEVELS, form.cavemanLevel)}
                    </span>
                  </SelectTrigger>
                  <SelectPopup>
                    {CAVEMAN_LEVELS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Ponytail</p>
                </div>
                <FlipButton
                  active={form.ponytailEnabled}
                  onToggle={() =>
                    set("ponytailEnabled", !form.ponytailEnabled)
                  }
                  activeLabel=""
                  inactiveLabel=""
                />
              </div>
              <div className="mt-3">
                <Select
                  value={form.ponytailLevel}
                  onValueChange={(v) =>
                    set("ponytailLevel", v ?? "full")
                  }
                  disabled={!form.ponytailEnabled}
                >
                  <SelectTrigger size="sm" className="w-full sm:w-44">
                    <span className="truncate">
                      {levelLabel(PONYTAIL_LEVELS, form.ponytailLevel)}
                    </span>
                  </SelectTrigger>
                  <SelectPopup>
                    {PONYTAIL_LEVELS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t border-border/70 pt-3">
            <p className="text-xs font-medium text-muted-foreground">
              Advanced
            </p>
            <Accordion className="rounded-xl border border-border bg-card px-4">
              <AccordionItem value="payload-capture" className="border-0">
                <div className="flex items-center justify-between gap-4 py-3">
                  <p className="text-sm font-medium">Capture full request payloads</p>
                  <FlipButton
                    active={form.payloadCaptureEnabled}
                    onToggle={() => set("payloadCaptureEnabled", !form.payloadCaptureEnabled)}
                    activeLabel=""
                    inactiveLabel=""
                  />
                </div>
                <AccordionTrigger className="w-fit flex-none justify-start gap-1 py-2 text-xs text-muted-foreground">
                  Details
                </AccordionTrigger>
                <AccordionContent className="pb-3">
                  <div className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
                    Payloads may include API keys, cookies, prompts, and provider responses. Applies to new request details.
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <CloudflareTunnelSettings
              requireApiKey={form.requireApiKey}
              requireLogin={form.requireLogin}
              hasPassword={Boolean(settingsQ.data?.hasPassword)}
            />
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Frame>
            <FrameHeader className="p-4">
              <p className="text-sm font-medium">Profile & display</p>
            </FrameHeader>
            <FramePanel className="space-y-5 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  src={form.profileAvatar || "/logo/avatar.svg"}
                  alt="Profile preview"
                  className="size-16 shrink-0 rounded-2xl border border-border bg-muted object-cover"
                />
                <div className="min-w-0 space-y-2">
                  <div>
                    <p className="text-sm font-medium">Profile photo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      PNG, JPG, WEBP, or GIF — max 2 MB.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="profile-photo-upload"
                      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-popover px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/50"
                    >
                      <Image className="size-3.5" />
                      Choose photo
                    </label>
                    <input
                      id="profile-photo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      onChange={onProfilePhotoChange}
                    />
                    {form.profileAvatar ? (
                      <RippleButton
                        size="sm"
                        variant="ghost"
                        onClick={() => set("profileAvatar", "")}
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </RippleButton>
                    ) : null}
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Profile name</span>
                <Input
                  value={form.profileName}
                  onChange={(event) => set("profileName", event.target.value)}
                  maxLength={40}
                  placeholder="Swoosh"
                />
                <span className="block text-[11px] text-muted-foreground/80">
                  Shown in the sidebar account card.
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="block text-xs font-medium text-muted-foreground">Cost currency</span>
                <Select
                  value={form.currency}
                  onValueChange={(value) => set("currency", value === "IDR" ? "IDR" : "USD")}
                >
                  <SelectTrigger size="sm" className="w-full sm:w-56">
                    <span className="truncate">
                      {form.currency === "IDR" ? "IDR · Indonesian Rupiah" : "USD · US Dollar"}
                    </span>
                  </SelectTrigger>
                <SelectPopup>
                  <SelectItem value="USD">USD · US Dollar</SelectItem>
                  <SelectItem value="IDR">IDR · Indonesian Rupiah</SelectItem>
                </SelectPopup>
                </Select>
              </label>

            </FramePanel>
          </Frame>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <ToggleRow
            label="Require API key"
            active={form.requireApiKey}
            onToggle={() => set("requireApiKey", !form.requireApiKey)}
          />
          <ToggleRow
            label="Require dashboard auth"
            active={form.requireLogin}
            onToggle={() => set("requireLogin", !form.requireLogin)}
          />
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Dashboard password</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {settingsQ.data?.hasPassword
                  ? "Password is set. Verify it before replacing it."
                  : "No custom password is set yet."}
              </p>
            </div>
            <RippleButton
              size="sm"
              variant="outline"
              onClick={() => setPasswordDialogOpen(true)}
            >
              {settingsQ.data?.hasPassword ? "Change password" : "Set password"}
            </RippleButton>
          </div>
          <ChangePasswordDialog
            open={passwordDialogOpen}
            onOpenChange={setPasswordDialogOpen}
            hasPassword={Boolean(settingsQ.data?.hasPassword)}
            onChanged={async () => {
              await qc.invalidateQueries({ queryKey: ["settings"] });
              toast.success("Dashboard password changed");
            }}
          />
          <div className="rounded-xl border border-destructive/30 bg-destructive/[0.04] px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium">Danger zone</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stop the router gracefully. Active requests can finish before the process exits.
                </p>
              </div>
              <RippleButton
                size="sm"
                variant="destructive-outline"
                onClick={() => setShutdownDialogOpen(true)}
                disabled={shuttingDown}
              >
                <Power />
                Shutdown router
              </RippleButton>
            </div>
          </div>
          <ShutdownDialog
            open={shutdownDialogOpen}
            onOpenChange={setShutdownDialogOpen}
            busy={shuttingDown}
            onConfirm={onShutdown}
          />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <DataTab
            dbPath={databasePathQ.data}
            loading={databasePathQ.isLoading}
          />
        </TabsContent>
      </Tabs>

      <ProfilePhotoCropDialog
        open={profileCropOpen}
        imageSrc={pendingProfilePhoto || ""}
        onOpenChange={onProfileCropOpenChange}
        onApply={onProfileCropApply}
      />
    </div>
  );
}

function DataTab({
  dbPath,
  loading,
}: {
  dbPath?: string;
  loading?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [exportPasswordDialogOpen, setExportPasswordDialogOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const displayDbPath = loading
    ? "Loading…"
    : dbPath
      ? compactDatabasePath(dbPath)
      : "Unavailable";

  function handleDownload() {
    setExportPasswordDialogOpen(true);
  }

  async function confirmDownload(password: string) {
    setDownloading(true);
    try {
      await downloadBackup(password, "full");
      toast.success("Backup downloaded");
      setExportPasswordDialogOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Download failed"));
    } finally {
      setDownloading(false);
    }
  }

  function clearRestoreSelection() {
    if (restoring) return;
    setRestoreFile(null);
    setRestorePassword("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleRestore(file: File) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Please select a .json backup file");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setRestorePassword("");
    setRestoreFile(file);
  }

  async function confirmRestore() {
    const file = restoreFile;
    if (!file || !restorePassword.trim() || restoring) return;

    setRestoring(true);
    try {
      const result = await restoreBackup(file, restorePassword);
      if (!result.success) {
        throw new Error(result.message || "Restore failed");
      }
      toast.success(result.message || "Backup restored");
      void qc.invalidateQueries({ queryKey: ["settings"] });
      void qc.invalidateQueries({ queryKey: ["keys"] });
      void qc.invalidateQueries({ queryKey: ["providers"] });
      void qc.invalidateQueries({ queryKey: ["providers-available"] });
      void qc.invalidateQueries({ queryKey: ["nodes"] });
      void qc.invalidateQueries({ queryKey: ["custom-models"] });
      void qc.invalidateQueries({ queryKey: ["combos"] });
    } catch (err) {
      toast.error(getErrorMessage(err, "Restore failed"));
    } finally {
      setRestoring(false);
      setRestoreFile(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <Frame>
        <FrameHeader className="flex flex-row items-center gap-3 p-4 pb-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-transparent">
            <Database className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium">Database Location</p>
          </div>
        </FrameHeader>
        <FramePanel className="p-4">
          <code className="block break-all rounded-md bg-surface px-3 py-1.5 font-mono text-xs text-muted-foreground">
            {displayDbPath}
          </code>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">Full data backup</p>
          </div>
          <RippleButton
            size="sm"
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="shrink-0 self-start sm:self-auto"
          >
            <Download className="h-4 w-4" />
            {downloading ? "Exporting…" : "Export full data"}
          </RippleButton>
        </FrameHeader>
      </Frame>

      <Frame>
        <FrameHeader className="flex flex-row items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Restore from Backup</p>
          </div>
          <RippleButton
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
          >
            <Upload className="h-4 w-4" />
            {restoring ? "Restoring…" : "Import JSON"}
          </RippleButton>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleRestore(file);
            }}
          />
        </FrameHeader>
      </Frame>

      <Dialog
        open={Boolean(restoreFile)}
        onOpenChange={(open) => {
          if (!open) clearRestoreSelection();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore backup?</DialogTitle>
            <DialogDescription>
              Restore <span className="font-medium text-foreground">{restoreFile?.name}</span> and replace the current data? This full backup includes provider credentials, configuration, usage history, daily totals, and request details. Redacted gateway API keys will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <PasswordField
              label="Dashboard password"
              value={restorePassword}
              onChange={(event) => setRestorePassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </DialogPanel>
          <DialogFooter>
            <RippleButton
              variant="outline"
              onClick={clearRestoreSelection}
              disabled={restoring}
            >
              Cancel
            </RippleButton>
            <RippleButton
              variant="destructive"
              onClick={() => void confirmRestore()}
              disabled={restoring || !restorePassword.trim()}
            >
              {restoring ? "Restoring…" : "Restore"}
            </RippleButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BackupPasswordDialog
        open={exportPasswordDialogOpen}
        onOpenChange={setExportPasswordDialogOpen}
        title="Export full data backup"
        description="Enter your dashboard password. This file includes provider credentials, usage history, and captured request details. Store it securely."
        busy={downloading}
        onConfirm={confirmDownload}
      />
    </div>
  );
}
