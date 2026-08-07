"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, X, MapPin, Loader2, Check, ImagePlus } from "lucide-react";
import { updateRestaurant, type ActionState } from "@/app/restaurants/actions";
import { loadKakaoMaps } from "@/lib/kakao";
import { createClient } from "@/lib/supabase/client";
import CoordPickerMap from "./CoordPickerMap";

const FIELD_CLASS =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand";
const LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-wide text-muted";
const MAX_PHOTO_SIZE = 8 * 1024 * 1024; // 8MB

export type EditableRestaurant = {
  id: number | string;
  name: string;
  categoryId?: number | null;
  address?: string | null;
  aloneOk?: number | null;
  memo?: string | null;
  lat?: number | null;
  lng?: number | null;
  imageUrl?: string | null;
  ownerId?: string | null;
};

export default function EditRestaurantModal({
  restaurant,
  categories,
  size = "sm",
}: {
  restaurant: EditableRestaurant;
  categories: { id: number; name: string }[];
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    restaurant.lat != null && restaurant.lng != null
      ? { lat: restaurant.lat, lng: restaurant.lng }
      : null
  );
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeMsg, setGeocodeMsg] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    restaurant.imageUrl ?? null
  );
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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
    setPhotoRemoved(false);
    setPhotoPreview((prev) => {
      if (prev && prev !== restaurant.imageUrl) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoRemoved(true);
    setPhotoPreview((prev) => {
      if (prev && prev !== restaurant.imageUrl) URL.revokeObjectURL(prev);
      return null;
    });
  };

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  const close = () => {
    setOpen(false);
    setState({});
    setGeocodeMsg(null);
  };

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      if (photoFile) {
        if (!restaurant.ownerId) {
          setUploadError("로그인 정보를 확인하지 못했어요.");
          return;
        }
        setUploading(true);
        const supabaseBrowser = createClient();
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const path = `${restaurant.ownerId}/${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`;
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
      } else if (photoRemoved) {
        formData.set("image_url", "");
      } else {
        formData.set("image_url", restaurant.imageUrl ?? "");
      }

      const result = await updateRestaurant({}, formData);
      setState(result);
      if (result.success) {
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
          "주소로 좌표를 못 찾았어요. 저장은 되지만 지도엔 안 나와요."
        );
      }
    });
  };

  const initialCategory = categories.find((c) => c.id === restaurant.categoryId);

  return (
    <>
      {size === "md" ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-muted shadow-sm transition-colors hover:border-brand hover:text-brand"
        >
          <Pencil className="h-3.5 w-3.5" />
          수정
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          aria-label="맛집 수정"
          title="맛집 수정"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:border-brand hover:text-brand"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 id="edit-title" className="text-[15px] font-bold text-foreground">
                맛집 수정
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
              <input type="hidden" name="restaurant_id" value={restaurant.id} />
              <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
              <input type="hidden" name="longitude" value={coords?.lng ?? ""} />

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>가게 이름</span>
                <input
                  name="name"
                  required
                  autoFocus
                  defaultValue={restaurant.name}
                  className={FIELD_CLASS}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>사진 (선택)</span>
                {photoPreview ? (
                  <div className="group relative h-28 w-28 overflow-hidden rounded-md border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 로컬 미리보기 또는 기존 사진 */}
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
                  defaultValue={restaurant.categoryId ?? ""}
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
                  defaultValue={initialCategory?.name ?? ""}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>주소</span>
                <div className="flex gap-2">
                  <input
                    ref={addressRef}
                    name="address"
                    defaultValue={restaurant.address ?? ""}
                    placeholder="예: 서울 중구 세종대로 110"
                    onChange={() => setGeocodeMsg(null)}
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
                  또는 아래 지도를 클릭해서 좌표를 직접 다시 찍을 수도 있어요.
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
                <select
                  name="alone_ok"
                  defaultValue={restaurant.aloneOk ?? ""}
                  className={FIELD_CLASS}
                >
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
                  defaultValue={restaurant.memo ?? ""}
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
                  {uploading ? "업로드 중..." : "저장하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
