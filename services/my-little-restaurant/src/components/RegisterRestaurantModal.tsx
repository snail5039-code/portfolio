"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from "react";
import { Plus, X, MapPin, Loader2, Check, ImagePlus } from "lucide-react";
import { createRestaurant, type ActionState } from "@/app/restaurants/actions";
import { loadKakaoMaps } from "@/lib/kakao";
import { createClient } from "@/lib/supabase/client";
import LoginRequiredModal from "./LoginRequiredModal";
import CoordPickerMap from "./CoordPickerMap";

const FIELD_CLASS =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand";
const LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-wide text-muted";
const MAX_PHOTO_SIZE = 8 * 1024 * 1024; // 8MB

export type RegisterPrefill = {
  name: string;
  address?: string;
  foodType?: string;
  lat?: number;
  lng?: number;
};

export type RegisterRestaurantModalHandle = {
  openWithPrefill: (prefill: RegisterPrefill) => void;
};

const RegisterRestaurantModal = forwardRef<
  RegisterRestaurantModalHandle,
  {
    categories: { id: number; name: string }[];
    isLoggedIn: boolean;
    userId?: string | null;
  }
>(function RegisterRestaurantModal({ categories, isLoggedIn, userId }, ref) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<RegisterPrefill | null>(null);
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      setUploadError("사진은 8MB 이하만 첨부할 수 있어요.");
      return;
    }
    setUploadError(null);
    setPhotoFile(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useImperativeHandle(ref, () => ({
    openWithPrefill: (next) => {
      setPrefill(next);
      setCoords(
        next.lat != null && next.lng != null
          ? { lat: next.lat, lng: next.lng }
          : null
      );
      setGeocodeMsg(
        next.lat != null && next.lng != null
          ? "지도에 표시된 위치의 좌표를 그대로 사용해요."
          : null
      );
      setOpen(true);
    },
  }));

  const showForm = open && isLoggedIn;

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [showForm]);

  const close = () => {
    setOpen(false);
    setState({});
    setGeocodeMsg(null);
    setPrefill(null);
    removePhoto();
    setUploadError(null);
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      if (photoFile) {
        if (!userId) {
          setUploadError("로그인 정보를 확인하지 못했어요.");
          return;
        }
        setUploading(true);
        const supabaseBrowser = createClient();
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${userId}/${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabaseBrowser.storage
          .from("restaurant-images")
          .upload(path, photoFile);
        setUploading(false);
        if (uploadErr) {
          setUploadError(`사진 업로드에 실패했어요: ${uploadErr.message}`);
          return;
        }
        const { data } = supabaseBrowser.storage
          .from("restaurant-images")
          .getPublicUrl(path);
        formData.set("image_url", data.publicUrl);
      }

      const result = await createRestaurant({}, formData);
      setState(result);
      if (result.success) {
        formRef.current?.reset();
        setCoords(null);
        setGeocodeMsg(null);
        setPrefill(null);
        removePhoto();
        setOpen(false);
      }
    });
  };

  const handleGeocode = async () => {
    const address = addressRef.current?.value.trim();
    if (!address) {
      setGeocodeMsg("주소를 먼저 입력해주세요.");
      return;
    }
    setGeocoding(true);
    setGeocodeMsg(null);
    await loadKakaoMaps();
    const kakao = window.kakao;
    if (!kakao) {
      setGeocoding(false);
      setGeocodeMsg("지도 SDK를 불러오지 못했어요.");
      return;
    }
    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      setGeocoding(false);
      if (status === kakao.maps.services.Status.OK && result[0]) {
        setCoords({ lat: Number(result[0].y), lng: Number(result[0].x) });
        setGeocodeMsg("좌표를 찾았어요. 지도에 핀이 표시됩니다.");
      } else {
        setCoords(null);
        setGeocodeMsg(
          "주소로 좌표를 못 찾았어요. 등록은 되지만 지도엔 안 나와요."
        );
      }
    });
  };

  const matchedCategory = prefill?.foodType
    ? categories.find((c) => c.name === prefill.foodType)
    : undefined;
  const prefillNote =
    prefill?.foodType && !matchedCategory
      ? `공공데이터 음식종류: ${prefill.foodType}`
      : "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        맛집 등록
      </button>

      <LoginRequiredModal
        open={open && !isLoggedIn}
        onClose={close}
        message="맛집을 등록하려면 로그인이 필요해요."
      />

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="register-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2
                id="register-title"
                className="text-[15px] font-bold text-foreground"
              >
                맛집 등록
              </h2>
              <button
                onClick={close}
                aria-label="닫기"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              ref={formRef}
              action={handleSubmit}
              className="flex flex-col gap-3.5 p-5"
            >
              <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
              <input type="hidden" name="longitude" value={coords?.lng ?? ""} />

              {prefill && (
                <p className="rounded-md bg-brand/10 px-3 py-2 text-[12px] leading-relaxed text-brand">
                  지도에서 선택한 모범음식점 정보를 채워왔어요. 확인하고
                  필요한 부분만 고쳐서 등록해주세요.
                </p>
              )}

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>가게 이름</span>
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={prefill?.name ?? ""}
                  placeholder="예: 할머니 손칼국수"
                  className={FIELD_CLASS}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>사진 (선택)</span>
                {photoPreview ? (
                  <div className="group relative h-28 w-28 overflow-hidden rounded-md border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 로컬 미리보기 */}
                    <img
                      src={photoPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={removePhoto}
                      aria-label="사진 제거"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand">
                    <ImagePlus className="h-3.5 w-3.5" />
                    사진 추가
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                )}
                {uploadError && (
                  <span className="text-[11px] text-red-500">{uploadError}</span>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>카테고리</span>
                <select
                  name="category_id"
                  required
                  defaultValue={matchedCategory?.id ?? ""}
                  onChange={(e) => {
                    const opt = e.target.selectedOptions[0];
                    const hidden = e.target.form?.elements.namedItem(
                      "category_name"
                    ) as HTMLInputElement | null;
                    if (hidden) hidden.value = opt?.text ?? "";
                  }}
                  className={FIELD_CLASS}
                >
                  <option value="">선택해주세요</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="hidden"
                  name="category_name"
                  defaultValue={matchedCategory?.name ?? ""}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>주소</span>
                <div className="flex gap-2">
                  <input
                    ref={addressRef}
                    name="address"
                    defaultValue={prefill?.address ?? ""}
                    placeholder="예: 서울 중구 세종대로 110"
                    onChange={() => {
                      setCoords(null);
                      setGeocodeMsg(null);
                    }}
                    className={FIELD_CLASS}
                  />
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={geocoding}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line px-2.5 py-2 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
                  >
                    {geocoding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : coords ? (
                      <Check className="h-3.5 w-3.5 text-brand" />
                    ) : (
                      <MapPin className="h-3.5 w-3.5" />
                    )}
                    좌표
                  </button>
                </div>
                {geocodeMsg && (
                  <span
                    className={`text-[11px] leading-relaxed ${
                      coords ? "text-brand" : "text-muted"
                    }`}
                  >
                    {geocodeMsg}
                  </span>
                )}

                <p className="text-[11px] text-muted">
                  또는 아래 지도를 클릭해서 좌표를 직접 찍을 수도 있어요.
                </p>
                <CoordPickerMap
                  value={coords}
                  onChange={(next) => {
                    setCoords(next);
                    setGeocodeMsg("지도에서 직접 좌표를 선택했어요.");
                  }}
                />
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>혼밥 난이도</span>
                <select name="alone_ok" defaultValue="" className={FIELD_CLASS}>
                  <option value="">선택 안 함</option>
                  <option value="1">1 · 아주 편함</option>
                  <option value="2">2 · 편함</option>
                  <option value="3">3 · 보통</option>
                  <option value="4">4 · 조금 부담</option>
                  <option value="5">5 · 혼자는 힘듦</option>
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>메모</span>
                <textarea
                  name="memo"
                  rows={2}
                  defaultValue={prefillNote}
                  placeholder="예: 웨이팅 15분, 1인석 있음"
                  className={`${FIELD_CLASS} resize-none leading-relaxed`}
                />
              </label>

              {state.error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {state.error}
                </p>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-surface-muted"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
                >
                  {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {uploading ? "업로드 중..." : "등록하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
});

export default RegisterRestaurantModal;
