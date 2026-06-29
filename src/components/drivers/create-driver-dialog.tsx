'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useFormik, type FormikProps } from 'formik';
import * as Yup from 'yup';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';

import {
  createDriver,
  removeDriverOnboardingFile,
  sendDriverOnboardingOtp,
  uploadDriverOnboardingFile,
  verifyDriverOnboardingOtp,
  type DriverDocType,
  type UploadedDriverFile,
} from '@/lib/actions';
import { EXPIRING_DOC_TYPES } from '@/lib/driver-docs';
import {
  VEHICLE_TYPES,
  vehicleLabel,
  type VehicleType,
} from '@/lib/vehicle-types';
import { adultCutoff, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STEPS = [
  'Driver & vehicle',
  'Documents',
  'Photos',
  'Review',
  'OTP & create',
];
const REQUIRED_DOCS: { type: DriverDocType; label: string }[] = [
  { type: 'license', label: 'Driving licence' },
  { type: 'rc', label: 'Vehicle RC' },
  { type: 'permit', label: 'Commercial permit' },
  { type: 'insurance', label: 'Vehicle insurance' },
  { type: 'puc', label: 'Pollution certificate (PUC)' },
  { type: 'aadhaar', label: 'Aadhaar / identity proof' },
];
const docExpires = (type: DriverDocType) => EXPIRING_DOC_TYPES.includes(type);
const isPdf = (file?: UploadedDriverFile) =>
  !!file && /\.pdf($|\?)/i.test(file.fileName);
const VEHICLE_PHOTOS = ['Front view', 'Rear view', 'Side view'];
const PHONE_RE = /^(\+91[-\s]?|0)?[6-9]\d{9}$/;
const DEFAULT_MILEAGE_BY_TYPE: Record<VehicleType, number> = {
  bike: 45,
  auto: 28,
  hatchback: 17,
  sedan: 15,
  premium: 12,
  xl: 10,
};

const initialValues = {
  fullName: '',
  email: '',
  phone: '',
  dob: '',
  gender: '',
  country: 'India',
  state: 'Telangana',
  city: 'Hyderabad',
  vehicleType: 'auto' as VehicleType,
  regNo: '',
  model: '',
  color: '',
  fuelType: 'petrol',
  mileageKmpl: DEFAULT_MILEAGE_BY_TYPE.auto,
  upiId: '',
  paymentPhone: '',
};

const UPI_RE = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

const validationSchema = Yup.object({
  fullName: Yup.string().trim().required('Full name is required'),
  phone: Yup.string()
    .trim()
    .required('Mobile number is required')
    .matches(PHONE_RE, 'Enter a valid Indian mobile number'),
  email: Yup.string()
    .trim()
    .email('Enter a valid email')
    .required('Email is required'),
  dob: Yup.date()
    .max(
      new Date(new Date().setFullYear(new Date().getFullYear() - 18)),
      'Driver must be at least 18',
    )
    .required('Date of birth is required'),
  gender: Yup.string()
    .oneOf(['male', 'female', 'other'])
    .required('Gender is required'),
  country: Yup.string().trim().required('Country is required'),
  state: Yup.string().trim().required('State is required'),
  city: Yup.string().trim().required('City is required'),
  regNo: Yup.string().trim().required('Vehicle registration is required'),
  model: Yup.string().trim().required('Vehicle model is required'),
  color: Yup.string().trim().required('Vehicle color is required'),
  fuelType: Yup.string().trim(),
  mileageKmpl: Yup.number()
    .typeError('Mileage must be a number')
    .moreThan(0, 'Mileage must be greater than 0')
    .required('Mileage is required'),
  upiId: Yup.string()
    .trim()
    .matches(UPI_RE, { message: 'Enter a valid UPI ID (e.g. name@bank)', excludeEmptyString: true }),
  paymentPhone: Yup.string()
    .trim()
    .matches(PHONE_RE, { message: 'Enter a valid Indian mobile number', excludeEmptyString: true }),
});

type DocUpload = {
  type: DriverDocType;
  label: string;
  file?: UploadedDriverFile;
  expiresAt?: string;
};

export function CreateDriverDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [docs, setDocs] = useState<DocUpload[]>(REQUIRED_DOCS);
  const [avatar, setAvatar] = useState<UploadedDriverFile>();
  const [paymentQr, setPaymentQr] = useState<UploadedDriverFile>();
  const [vehiclePhotos, setVehiclePhotos] = useState<
    (UploadedDriverFile | undefined)[]
  >([undefined, undefined, undefined]);
  const [verified, setVerified] = useState(false);
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [testCode, setTestCode] = useState('');
  const [otp, setOtp] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    label: string;
    file: UploadedDriverFile;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: (values) => {
      if (
        !avatar ||
        docs.some((doc) => !doc.file) ||
        vehiclePhotos.some((photo) => !photo)
      )
        return;
      if (docs.some((doc) => docExpires(doc.type) && !doc.expiresAt)) {
        setError('Enter the expiry date for every document that expires.');
        return;
      }
      setError(null);
      startTransition(async () => {
        const result = await createDriver({
          ...values,
          avatar,
          vehiclePhotos: vehiclePhotos as UploadedDriverFile[],
          documents: docs.map((doc) => ({
            type: doc.type,
            file: doc.file!,
            expiresAt: doc.expiresAt,
          })),
          paymentQr,
          verifiedInPerson: verified,
          otpChallengeId,
        });
        if (result) setError(result);
        else {
          setOpen(false);
          resetAll();
          router.refresh();
        }
      });
    },
  });

  const resetAll = () => {
    setStep(0);
    formik.resetForm();
    setDocs(REQUIRED_DOCS);
    setAvatar(undefined);
    setPaymentQr(undefined);
    setVehiclePhotos([undefined, undefined, undefined]);
    setVerified(false);
    setOtpChallengeId('');
    setTestCode('');
    setOtp('');
    setOtpVerified(false);
    setUploading(null);
    setError(null);
  };

  const upload = async (
    file: File | undefined,
    kind: 'avatar' | 'vehicle' | 'document' | 'payment',
    key: string,
  ): Promise<UploadedDriverFile | undefined> => {
    if (!file) return undefined;
    setUploading(key);
    setError(null);
    const data = new FormData();
    data.set('file', file);
    const result = await uploadDriverOnboardingFile(data, kind);
    setUploading(null);
    if (result.error) {
      setError(result.error);
      return undefined;
    }
    return result.file;
  };

  const next = async () => {
    setError(null);
    if (step === 0) {
      const errors = await formik.validateForm();
      if (Object.keys(errors).length) {
        formik.setTouched(
          Object.fromEntries(
            Object.keys(initialValues).map((key) => [key, true]),
          ),
        );
        return;
      }
      if (!formik.values.upiId.trim() && !formik.values.paymentPhone.trim()) {
        setError('Add a UPI ID or payment phone so riders can pay the driver.');
        return;
      }
    }
    if (step === 1 && docs.some((doc) => !doc.file)) {
      setError('Upload all required documents before continuing.');
      return;
    }
    if (
      step === 1 &&
      docs.some((doc) => docExpires(doc.type) && !doc.expiresAt)
    ) {
      setError('Enter the expiry date for every document that expires.');
      return;
    }
    if (step === 2 && (!avatar || vehiclePhotos.some((photo) => !photo))) {
      setError('Upload the driver photo and all three vehicle views.');
      return;
    }
    if (step === 3 && !verified) {
      setError(
        'Confirm that all originals and the vehicle were verified in person.',
      );
      return;
    }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
  };

  const removeUpload = async (
    file: UploadedDriverFile | undefined,
    clear: () => void,
  ) => {
    if (!file) return;
    setUploading(`remove-${file.storagePath}`);
    const result = await removeDriverOnboardingFile(file.storagePath);
    setUploading(null);
    if (result) setError(result);
    else clear();
  };

  const sendOtp = async () => {
    setError(null);
    const result = await sendDriverOnboardingOtp(formik.values.phone);
    if (result.error) setError(result.error);
    else {
      setOtpChallengeId(result.challengeId ?? '');
      setTestCode(result.testCode ?? '');
      setOtp('');
      setOtpVerified(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    const result = await verifyDriverOnboardingOtp(otpChallengeId, otp);
    if (result) setError(result);
    else setOtpVerified(true);
  };

  const fieldError = (key: keyof typeof initialValues) =>
    formik.touched[key] && formik.errors[key] ? (
      <p className="text-xs text-danger">{formik.errors[key] as string}</p>
    ) : null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) resetAll();
        }}
      >
        <DialogTrigger asChild>
          <Button>
            <UserPlus className="size-4" /> Add driver
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create verified driver</DialogTitle>
            <DialogDescription>
              Every identity, vehicle, photo, and document field is required.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            {STEPS.map((label, index) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    index < step && 'bg-success text-white',
                    index === step && 'bg-primary text-primary-foreground',
                    index > step && 'bg-muted text-muted-foreground',
                  )}
                >
                  {index < step ? <Check className="size-3.5" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'hidden text-xs sm:block',
                    index === step ? 'font-medium' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <div className="h-px flex-1 bg-border" />
                )}
              </div>
            ))}
          </div>

          <div className="min-h-72">
            {step === 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TextField
                  name="fullName"
                  label="Full name"
                  formik={formik}
                  error={fieldError('fullName')}
                />
                <TextField
                  name="phone"
                  label="Mobile number"
                  formik={formik}
                  error={fieldError('phone')}
                />
                <TextField
                  name="email"
                  label="Email"
                  type="email"
                  formik={formik}
                  error={fieldError('email')}
                />
                <TextField
                  name="dob"
                  label="Date of birth"
                  type="date"
                  max={adultCutoff()}
                  formik={formik}
                  error={fieldError('dob')}
                />
                <Stack label="Gender">
                  <Select
                    value={formik.values.gender}
                    onValueChange={(value) =>
                      formik.setFieldValue('gender', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError('gender')}
                </Stack>
                <FixedSelect
                  label="Country"
                  value={formik.values.country}
                  options={[['India', 'India']]}
                  onChange={(value) => formik.setFieldValue('country', value)}
                />
                <FixedSelect
                  label="State"
                  value={formik.values.state}
                  options={[['Telangana', 'Telangana']]}
                  onChange={(value) => formik.setFieldValue('state', value)}
                />
                <FixedSelect
                  label="City"
                  value={formik.values.city}
                  options={[['Hyderabad', 'Hyderabad']]}
                  onChange={(value) => formik.setFieldValue('city', value)}
                />
                <Stack label="Vehicle type">
                  <Select
                    value={formik.values.vehicleType}
                    onValueChange={(value) => {
                      const vehicleType = value as VehicleType;
                      formik.setFieldValue('vehicleType', vehicleType);
                      formik.setFieldValue(
                        'mileageKmpl',
                        DEFAULT_MILEAGE_BY_TYPE[vehicleType] ?? 18,
                      );
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {vehicleLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Stack>
                <TextField
                  name="regNo"
                  label="Registration number"
                  formik={formik}
                  error={fieldError('regNo')}
                />
                <TextField
                  name="model"
                  label="Vehicle model"
                  formik={formik}
                  error={fieldError('model')}
                />
                <TextField
                  name="color"
                  label="Vehicle color"
                  formik={formik}
                  error={fieldError('color')}
                />
                <Stack label="Fuel type">
                  <Select
                    value={formik.values.fuelType}
                    onValueChange={(value) =>
                      formik.setFieldValue('fuelType', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="petrol">Petrol</SelectItem>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="cng">CNG</SelectItem>
                      <SelectItem value="ev">EV</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldError('fuelType')}
                </Stack>
                <TextField
                  name="mileageKmpl"
                  label="Mileage (km/l)"
                  type="number"
                  formik={formik}
                  error={fieldError('mileageKmpl')}
                />
                <TextField
                  name="upiId"
                  label="Driver UPI ID"
                  formik={formik}
                  error={fieldError('upiId')}
                />
                <TextField
                  name="paymentPhone"
                  label="Payment phone (UPI number)"
                  formik={formik}
                  error={fieldError('paymentPhone')}
                />
                <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
                  Riders pay the driver directly. Add a UPI ID and/or payment
                  phone — at least one is required. A payment QR image can be
                  uploaded in the Photos step.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Upload clear images or PDFs of every original document.
                </p>
                {docs.map((doc, index) => (
                  <div key={doc.type} className="space-y-1.5">
                    <FileUploadRow
                      label={doc.label}
                      file={doc.file}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      busy={
                        uploading === `doc-${doc.type}` ||
                        uploading === `remove-${doc.file?.storagePath}`
                      }
                      onRemove={() =>
                        removeUpload(doc.file, () =>
                          setDocs((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, file: undefined }
                                : item,
                            ),
                          ),
                        )
                      }
                      onChange={async (file) => {
                        const uploaded = await upload(
                          file,
                          'document',
                          `doc-${doc.type}`,
                        );
                        if (uploaded)
                          setDocs((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, file: uploaded }
                                : item,
                            ),
                          );
                      }}
                    />
                    {docExpires(doc.type) && (
                      <div className="flex items-center gap-2 pl-1">
                        <Label
                          htmlFor={`expiry-${doc.type}`}
                          className="text-xs text-muted-foreground"
                        >
                          Expires on
                        </Label>
                        <Input
                          id={`expiry-${doc.type}`}
                          type="date"
                          className="h-8 w-44"
                          value={doc.expiresAt ?? ''}
                          onChange={(e) =>
                            setDocs((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, expiresAt: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FileUploadRow
                  label="Driver profile photo"
                  file={avatar}
                  accept="image/jpeg,image/png,image/webp"
                  busy={
                    uploading === 'avatar' ||
                    uploading === `remove-${avatar?.storagePath}`
                  }
                  onRemove={() =>
                    removeUpload(avatar, () => setAvatar(undefined))
                  }
                  onChange={async (file) => {
                    const uploaded = await upload(file, 'avatar', 'avatar');
                    if (uploaded) setAvatar(uploaded);
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  {VEHICLE_PHOTOS.map((label, index) => (
                    <FileUploadRow
                      key={label}
                      label={label}
                      file={vehiclePhotos[index]}
                      accept="image/jpeg,image/png,image/webp"
                      busy={
                        uploading === `vehicle-${index}` ||
                        uploading ===
                          `remove-${vehiclePhotos[index]?.storagePath}`
                      }
                      onRemove={() =>
                        removeUpload(vehiclePhotos[index], () =>
                          setVehiclePhotos((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? undefined : item,
                            ),
                          ),
                        )
                      }
                      onChange={async (file) => {
                        const uploaded = await upload(
                          file,
                          'vehicle',
                          `vehicle-${index}`,
                        );
                        if (uploaded)
                          setVehiclePhotos((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? uploaded : item,
                            ),
                          );
                      }}
                    />
                  ))}
                </div>
                <FileUploadRow
                  label="Payment QR (optional)"
                  file={paymentQr}
                  accept="image/jpeg,image/png,image/webp"
                  busy={
                    uploading === 'payment-qr' ||
                    uploading === `remove-${paymentQr?.storagePath}`
                  }
                  onRemove={() =>
                    removeUpload(paymentQr, () => setPaymentQr(undefined))
                  }
                  onChange={async (file) => {
                    const uploaded = await upload(file, 'payment', 'payment-qr');
                    if (uploaded) setPaymentQr(uploaded);
                  }}
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
                  <Preview label="Driver" value={formik.values.fullName} />
                  <Preview label="Phone" value={formik.values.phone} />
                  <Preview label="Email" value={formik.values.email} />
                  <Preview label="Date of birth" value={formik.values.dob} />
                  <Preview label="Gender" value={formik.values.gender} />
                  <Preview
                    label="Location"
                    value={`${formik.values.city}, ${formik.values.state}, ${formik.values.country}`}
                  />
                  <Preview
                    label="Vehicle"
                    value={`${formik.values.vehicleType} · ${formik.values.regNo}`}
                  />
                  <Preview
                    label="Model / color"
                    value={`${formik.values.model} · ${formik.values.color}`}
                  />
                  <Preview
                    label="Fuel / mileage"
                    value={`${formik.values.fuelType} · ${formik.values.mileageKmpl} km/l`}
                  />
                  <Preview
                    label="UPI ID"
                    value={formik.values.upiId || '—'}
                  />
                  <Preview
                    label="Payment phone"
                    value={formik.values.paymentPhone || '—'}
                  />
                  <Preview
                    label="Payment QR"
                    value={paymentQr ? 'Uploaded' : 'Not provided'}
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Photos
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { file: avatar, label: 'Driver photo' },
                      ...VEHICLE_PHOTOS.map((label, index) => ({
                        file: vehiclePhotos[index],
                        label,
                      })),
                    ].map(({ file, label }) =>
                      file ? (
                        <PreviewThumb
                          key={file.storagePath}
                          label={label}
                          file={file}
                          onOpen={() => setPreview({ label, file })}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Documents
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {docs.map((doc) =>
                      doc.file ? (
                        <PreviewThumb
                          key={doc.type}
                          label={doc.label}
                          file={doc.file}
                          onOpen={() =>
                            setPreview({ label: doc.label, file: doc.file! })
                          }
                        />
                      ) : null,
                    )}
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-muted/50 p-4">
                  <input
                    type="checkbox"
                    checked={verified}
                    onChange={(event) => setVerified(event.target.checked)}
                    className="mt-1 size-4"
                  />
                  <span>
                    <span className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="size-4 text-success" /> Originals
                      verified in person
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      I checked the driver identity, original KYC documents,
                      vehicle, registration, and uploaded images. Creating this
                      record immediately approves the driver and sends a welcome
                      notification.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">
                    Verify mobile {formik.values.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    The challenge, verifying staff member, verification time,
                    and final creator are recorded.
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1 space-y-1.5">
                    <Label>6-digit OTP</Label>
                    <Input
                      value={otp}
                      onChange={(event) =>
                        setOtp(
                          event.target.value.replace(/\D/g, '').slice(0, 6),
                        )
                      }
                      inputMode="numeric"
                      maxLength={6}
                      disabled={!otpChallengeId || otpVerified}
                    />
                  </div>
                  <Button variant="outline" onClick={sendOtp}>
                    {otpChallengeId ? 'Resend OTP' : 'Send OTP'}
                  </Button>
                  <Button
                    onClick={verifyOtp}
                    disabled={
                      !otpChallengeId || otp.length !== 6 || otpVerified
                    }
                  >
                    {otpVerified ? (
                      <>
                        <Check className="size-4" /> Verified
                      </>
                    ) : (
                      'Verify OTP'
                    )}
                  </Button>
                </div>
                {testCode && !otpVerified && (
                  <p className="text-xs text-warning">
                    Test OTP: {testCode} (replace with SMS provider before
                    production)
                  </p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0 || isPending || !!uploading}
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!!uploading}>
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => formik.handleSubmit()}
                disabled={isPending || !verified || !otpVerified || !!uploading}
              >
                {isPending ? 'Creating…' : 'Create approved driver'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!preview}
        onOpenChange={(value) => {
          if (!value) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.label}</DialogTitle>
            <DialogDescription>{preview?.file.fileName}</DialogDescription>
          </DialogHeader>
          {preview &&
            (isPdf(preview.file) ? (
              <iframe
                src={preview.file.publicUrl}
                title={preview.label}
                className="h-[75vh] w-full rounded-lg border border-border"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.file.publicUrl}
                alt={preview.label}
                className="max-h-[75vh] w-full rounded-lg object-contain"
              />
            ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

function TextField({
  name,
  label,
  type = 'text',
  max,
  formik,
  error,
}: {
  name: keyof typeof initialValues;
  label: string;
  type?: string;
  max?: string;
  formik: FormikProps<typeof initialValues>;
  error: React.ReactNode;
}) {
  return (
    <Stack label={label}>
      <Input
        name={name}
        type={type}
        max={max}
        value={String(formik.values[name])}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
      />
      {error}
    </Stack>
  );
}

function FileUploadRow({
  label,
  file,
  accept,
  busy,
  onChange,
  onRemove,
}: {
  label: string;
  file?: UploadedDriverFile;
  accept: string;
  busy: boolean;
  onChange: (file?: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <Label className="text-sm">{label}</Label>
      <div className="mt-2 flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          <Upload className="size-4" />{' '}
          {busy ? 'Uploading…' : file ? 'Replace' : 'Choose file'}
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(event) => onChange(event.target.files?.[0])}
          />
        </label>
        <span
          className={cn(
            'min-w-0 truncate text-xs',
            file ? 'text-success' : 'text-muted-foreground',
          )}
        >
          {file?.fileName ?? 'Required'}
        </span>
        {file && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 className="size-4 text-danger" />
          </Button>
        )}
      </div>
    </div>
  );
}

function PreviewThumb({
  label,
  file,
  onOpen,
}: {
  label: string;
  file: UploadedDriverFile;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-1.5 rounded-lg border border-border p-2 text-left transition hover:border-primary"
    >
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-md bg-muted">
        {isPdf(file) ? (
          <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <FileText className="size-6" /> PDF
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.publicUrl}
            alt={label}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <span className="text-xs font-medium">{label}</span>
      <span className="truncate text-[11px] text-muted-foreground">
        {file.fileName}
      </span>
    </button>
  );
}

function FixedSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <Stack label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Stack>
  );
}

function Preview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Stack({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
