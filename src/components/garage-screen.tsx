import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, router, type Href, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, AppState, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { QuickAddFab } from '@/components/quick-add';
import { DetailOverlayHeader, detailHeaderContentInset } from '@/components/detail-overlay-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card, Chevron, MetaPill, SectionLabel, type Tone } from '@/components/torque-ui';
import { VehicleDashboard } from '@/components/vehicle-dashboard';
import { ScheduleManager } from '@/features/schedules/schedule-manager';
import { calculateDue } from '@/features/schedules/due-calculator';
import { Spacing, TorqueColors } from '@/constants/theme';
import { civilToday, isCivilDate, isMileage, mileageToMilliMiles as toMilliMiles } from '@/utils/local-values';
import { maintenanceStore, type GarageVehicle, type ManualOdometerReading, type TrackingSetup, type TrackingSnapshot } from '../../modules/maintenance-store';

/** Per-vehicle due rollup shown on the garage card badge. */
type DueSummary = Readonly<{ count: number; tone: Exclude<Tone, 'trip' | 'primary' | 'neutral'> }>;

type Draft = Readonly<{
  nickname: string;
  year: string;
  make: string;
  model: string;
  odometer: string;
}>;
const emptyDraft: Draft = {
  nickname: '',
  year: '',
  make: '',
  model: '',
  odometer: '',
};

export function GarageScreen() {
  const { vehicleId, scheduleId, quickAdd } = useLocalSearchParams<{
    vehicleId?: string;
    scheduleId?: string;
    quickAdd?: string;
  }>();
  const [vehicles, setVehicles] = useState<GarageVehicle[]>([]);
  const [archivedVehicles, setArchivedVehicles] = useState<GarageVehicle[]>([]);
  const [dueByVehicle, setDueByVehicle] = useState<Record<string, DueSummary>>({});
  const [trackingState, setTrackingState] = useState<TrackingSnapshot['state']>('idle');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [viewingVehicleId, setViewingVehicleId] = useState<string>();
  const [editingVehicleId, setEditingVehicleId] = useState<string>();
  const [editingScheduleId, setEditingScheduleId] = useState<string>();
  const [odometerVehicleId, setOdometerVehicleId] = useState<string>();

  const loadVehicles = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    loadGarageVehicles()
      .then(({ active, archived, dueByVehicle: due, trackingState: tracking }) => {
        setVehicles(active);
        setArchivedVehicles(archived);
        setDueByVehicle(due);
        setTrackingState(tracking);
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Vehicles could not be loaded.'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(loadVehicles);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void loadVehicles();
    });
    return () => subscription.remove();
  }, [loadVehicles]);

  if (adding) {
    return (
      <VehicleForm
        onCancel={() => setAdding(false)}
        onCreated={(vehicle) => {
          setVehicles((current) => [...current, vehicle]);
          setAdding(false);
        }}
      />
    );
  }

  // Quick Add routes its odometer action here so the reading form owns the flow.
  const odometerVehicle = vehicles.find((vehicle) => vehicle.id === ((quickAdd === 'odometer' ? vehicleId : undefined) ?? odometerVehicleId));
  if (odometerVehicle) {
    const closeOdometer = () => {
      setOdometerVehicleId(undefined);
      router.setParams({ quickAdd: undefined, vehicleId: undefined });
    };
    return (
      <OdometerReadingForm
        vehicle={odometerVehicle}
        onCancel={closeOdometer}
        onSaved={() => {
          closeOdometer();
          loadVehicles();
        }}
      />
    );
  }

  const editingVehicle = vehicles.find((vehicle) => vehicle.id === ((quickAdd ? undefined : vehicleId) ?? editingVehicleId));
  if (editingVehicle) {
    const closeEditor = () => {
      setEditingVehicleId(undefined);
      setEditingScheduleId(undefined);
      router.setParams({ vehicleId: undefined, scheduleId: undefined });
    };
    return (
      <VehicleEditor
        key={editingVehicle.id}
        vehicle={editingVehicle}
        onCancel={closeEditor}
        onChanged={() => {
          closeEditor();
          loadVehicles();
        }}
        openScheduleId={scheduleId ?? editingScheduleId}
        onScheduleOpened={() => {
          setEditingScheduleId(undefined);
          router.setParams({ scheduleId: undefined });
        }}
      />
    );
  }

  const viewingVehicle = vehicles.find((vehicle) => vehicle.id === viewingVehicleId);
  if (viewingVehicle) {
    return (
      <VehicleDashboard
        vehicle={viewingVehicle}
        onBack={() => setViewingVehicleId(undefined)}
        onEdit={() => setEditingVehicleId(viewingVehicle.id)}
        onOpenSchedule={(nextScheduleId) => {
          setEditingScheduleId(nextScheduleId);
          setEditingVehicleId(viewingVehicle.id);
        }}
        onUpdateOdometer={() => setOdometerVehicleId(viewingVehicle.id)}
      />
    );
  }

  return (
    <ThemedView collapsable={false} style={styles.screen}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          <ThemedText accessibilityRole="header" style={styles.pageTitle}>
            Garage
          </ThemedText>
          {loading ? (
            <ThemedText>Loading vehicles...</ThemedText>
          ) : loadError ? (
            <View style={styles.empty}>
              <ThemedText accessibilityLiveRegion="polite">{loadError}</ThemedText>
              <ActionButton label="Try again" onPress={loadVehicles} />
            </View>
          ) : vehicles.length === 0 && archivedVehicles.length === 0 ? (
            <EmptyGarage onAdd={() => setAdding(true)} />
          ) : (
            <>
              {trackingState !== 'idle' ? <TrackingBanner state={trackingState} /> : null}
              <VehicleList
                vehicles={vehicles}
                archivedVehicles={archivedVehicles}
                dueByVehicle={dueByVehicle}
                onAdd={() => setAdding(true)}
                onChanged={loadVehicles}
                onOpen={(nextVehicleId) => {
                  router.setParams({ vehicleId: undefined, scheduleId: undefined });
                  setViewingVehicleId(nextVehicleId);
                }}
              />
            </>
          )}
        </ScrollView>
        <QuickAddFab vehicles={vehicles} />
    </ThemedView>
  );
}

async function loadGarageVehicles(): Promise<{
  active: GarageVehicle[];
  archived: GarageVehicle[];
  dueByVehicle: Record<string, DueSummary>;
  trackingState: TrackingSnapshot['state'];
}> {
  const [active, archived] = await Promise.all([
    maintenanceStore.product.getVehicles(),
    maintenanceStore.product.getArchivedVehicles().catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('Rebuild the iOS development client')) return [];
      throw error;
    }),
  ]);
  const today = civilToday();
  const [snapshot, dueEntries] = await Promise.all([
    maintenanceStore.tracking.getSnapshot().catch(() => ({ state: 'idle' as const })),
    Promise.all(
      active.map(async (vehicle): Promise<[string, DueSummary]> => {
        const schedules = await maintenanceStore.product.getMaintenanceSchedules(vehicle.id).catch(() => []);
        const states = schedules.map((schedule) => calculateDue(schedule, vehicle.currentOdometerMilliMiles, today).state);
        const count = states.filter((state) => state !== 'current').length;
        const tone = states.includes('due') ? 'danger' : 'warning';
        return [vehicle.id, { count, tone }];
      }),
    ),
  ]);
  return { active, archived, dueByVehicle: Object.fromEntries(dueEntries), trackingState: snapshot.state };
}

function EmptyGarage({ onAdd }: Readonly<{ onAdd: () => void }>) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <SymbolView
          name={{
            ios: 'car.fill',
            android: 'directions_car',
            web: 'directions_car',
          }}
          tintColor={TorqueColors.primary}
          size={38}
        />
      </View>
      <ThemedText accessibilityRole="header" style={styles.emptyTitle}>
        No vehicles yet
      </ThemedText>
      <ThemedText style={styles.emptyCopy}>Add a vehicle to track maintenance and odometer readings. Automatic trip tracking is optional and set up later.</ThemedText>
      <ActionButton label="Add a vehicle" onPress={onAdd} />
      <Link href={'/settings' as Href} asChild>
        <Pressable accessibilityRole="link">
          <ThemedText type="linkPrimary">How this app stores your data</ThemedText>
        </Pressable>
      </Link>
    </View>
  );
}

function VehicleList({
  vehicles,
  archivedVehicles,
  dueByVehicle,
  onAdd,
  onChanged,
  onOpen,
}: Readonly<{
  vehicles: GarageVehicle[];
  archivedVehicles: GarageVehicle[];
  dueByVehicle: Record<string, DueSummary>;
  onAdd: () => void;
  onChanged: () => void;
  onOpen: (vehicleId: string) => void;
}>) {
  return (
    <View style={styles.list}>
      {vehicles.map((vehicle) => (
        <VehicleCard key={vehicle.id} vehicle={vehicle} due={dueByVehicle[vehicle.id]} onPress={() => onOpen(vehicle.id)} />
      ))}
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.addLink}>
        <ThemedText style={styles.addLinkText}>Add a vehicle</ThemedText>
      </Pressable>
      {archivedVehicles.length > 0 && (
        <>
          <ThemedText accessibilityRole="header" style={styles.sectionTitle}>
            Archived vehicles
          </ThemedText>
          {archivedVehicles.map((vehicle) => (
            <ArchivedVehicleCard key={vehicle.id} vehicle={vehicle} onChanged={onChanged} />
          ))}
        </>
      )}
    </View>
  );
}

function TrackingBanner({ state }: Readonly<{ state: Exclude<TrackingSnapshot['state'], 'idle'> }>) {
  const tracking = state === 'tracking';
  return (
    <Link href={'/activity' as Href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={tracking ? 'A trip is in progress. Open Activity.' : 'Trip recovery in progress. Open Activity.'} style={styles.trackingBanner}>
        <View style={[styles.bannerDot, { backgroundColor: tracking ? TorqueColors.successDot : TorqueColors.warningDot }]} />
        <View style={styles.bannerBody}>
          <ThemedText style={styles.bannerTitle}>{tracking ? 'Trip in progress' : 'Recovering trip'}</ThemedText>
          <ThemedText style={styles.bannerCopy}>{tracking ? 'One trip is active on this device.' : 'Safely resolving the previous trip.'}</ThemedText>
        </View>
        <Chevron />
      </Pressable>
    </Link>
  );
}

function VehicleCard({ vehicle, due, onPress }: Readonly<{ vehicle: GarageVehicle; due?: DueSummary; onPress: () => void }>) {
  const model = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim();
  const showNickname = vehicle.nickname.trim().length > 0 && !model.toLowerCase().includes(vehicle.nickname.trim().toLowerCase());
  const automatic = vehicle.trackingReadiness === 'automatic_setup';
  const dueCount = due?.count ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${vehicle.nickname}, ${model}, ${formatMiles(vehicle.currentOdometerMilliMiles)} miles estimated${dueCount > 0 ? `, ${dueCount} due` : ''}, ${automatic ? 'automatic tracking on' : 'manual only'}`}
      onPress={onPress}
    >
      <ThemedView style={styles.vehicleCard}>
        <View>
          {vehicle.heroPhotoUri ? (
            <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.vehicleHero} accessibilityLabel={`${vehicle.nickname} hero photo`} />
          ) : (
            <View style={styles.vehicleHero}>
              <SymbolView name={{ ios: 'car.side.fill', android: 'directions_car', web: 'directions_car' }} tintColor="#B9D8F7" size={54} />
            </View>
          )}
          {automatic ? (
            <View style={styles.trackingBadge}>
              <View style={styles.trackingBadgeDot} />
              <ThemedText style={styles.trackingBadgeText}>Tracking</ThemedText>
            </View>
          ) : null}
        </View>
        <View style={styles.vehicleDetails}>
          <View style={styles.vehicleTitleRow}>
            <View style={styles.vehicleTitleText}>
              {showNickname ? <ThemedText style={styles.vehicleNickname}>{vehicle.nickname}</ThemedText> : null}
              <ThemedText style={styles.vehicleName}>{model}</ThemedText>
            </View>
            {dueCount > 0 && due ? <MetaPill label={`${dueCount} due`} tone={due.tone} /> : null}
          </View>
          <View style={styles.vehicleMetaRow}>
            <ThemedText style={styles.vehicleMeta}>
              <ThemedText style={styles.vehicleMetaStrong}>{formatMiles(vehicle.currentOdometerMilliMiles)}</ThemedText> mi est.
            </ThemedText>
            <ThemedText style={styles.vehicleMetaSeparator}>·</ThemedText>
            <View style={styles.trackingStatus}>
              <SymbolView name={{ ios: 'bolt.fill', android: 'bolt', web: 'bolt' }} tintColor={automatic ? TorqueColors.success : TorqueColors.secondary} size={12} />
              <ThemedText style={[styles.vehicleMeta, automatic && styles.trackingOn]}>{automatic ? 'Auto trip on' : 'Manual only'}</ThemedText>
            </View>
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

function ArchivedVehicleCard({ vehicle, onChanged }: Readonly<{ vehicle: GarageVehicle; onChanged: () => void }>) {
  const restore = async () => {
    try {
      await maintenanceStore.product.restoreVehicle(vehicle.id);
      onChanged();
    } catch {
      Alert.alert('Could not restore vehicle', 'The vehicle remains archived. Try again.');
    }
  };
  return (
    <ThemedView style={styles.archivedCard}>
      <View style={styles.archivedDetails}>
        <ThemedText style={styles.vehicleName}>{vehicle.nickname}</ThemedText>
        <ThemedText style={styles.vehicleModel}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </ThemedText>
        <ThemedText style={styles.vehicleMileage}>Archived · tracking setup removed</ThemedText>
      </View>
      <ActionButton label="Restore" onPress={restore} />
    </ThemedView>
  );
}

function VehicleEditor({
  vehicle,
  onCancel,
  onChanged,
  openScheduleId,
  onScheduleOpened,
}: Readonly<{
  vehicle: GarageVehicle;
  onCancel: () => void;
  onChanged: () => void;
  openScheduleId?: string;
  onScheduleOpened: () => void;
}>) {
  const scrollView = useRef<ScrollView>(null);
  const [draft, setDraft] = useState({
    nickname: vehicle.nickname,
    year: String(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = draft.nickname.trim() && draft.make.trim() && draft.model.trim() && Number.isInteger(Number(draft.year)) && Number(draft.year) >= 1886;
  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setError(null);
    try {
      await maintenanceStore.product.updateVehicle({
        id: vehicle.id,
        nickname: draft.nickname.trim(),
        year: Number(draft.year),
        make: draft.make.trim(),
        model: draft.model.trim(),
      });
      onChanged();
    } catch {
      setError('The profile could not be saved. Your changes are still here.');
    } finally {
      setSaving(false);
    }
  };
  const archive = () =>
    Alert.alert('Archive this vehicle?', 'Its history stays available, but active tracking setup is removed. You can restore the profile later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          try {
            await maintenanceStore.product.archiveVehicle(vehicle.id);
            onChanged();
          } catch {
            setError('This vehicle cannot be archived while a trip is active. Stop the trip first.');
          }
        },
      },
    ]);
  const changePhoto = async () => {
    setError(null);
    try {
      const sourceUri = await chooseHeroPhoto();
      if (!sourceUri) return;
      await maintenanceStore.product.replaceHeroPhoto({
        vehicleId: vehicle.id,
        sourceUri,
      });
      onChanged();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The photo could not be added. Your current photo is unchanged.');
    }
  };
  const removePhoto = async () => {
    try {
      await maintenanceStore.product.removeHeroPhoto(vehicle.id);
      onChanged();
    } catch {
      setError('The photo could not be removed. Try again.');
    }
  };
  const photoOptions = () => {
    const options = vehicle.heroPhotoUri ? ['Replace photo', 'Remove photo', 'Cancel'] : ['Choose photo', 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex: options.length - 1,
        destructiveButtonIndex: vehicle.heroPhotoUri ? 1 : undefined,
      },
      (index) => {
        if (index === 0) void changePhoto();
        if (vehicle.heroPhotoUri && index === 1) void removePhoto();
      },
    );
  };
  return (
    <ThemedView collapsable={false} style={styles.screen}>
        <ScrollView ref={scrollView} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, styles.detailContent]} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.formIntro}>Identity fields can be changed here. Odometer readings remain an auditable history and are updated separately.</ThemedText>
          <TrackingSetupStatus vehicleId={vehicle.id} vehicleName={vehicle.nickname} />
          <Pressable accessibilityRole="button" accessibilityLabel="Hero photo" accessibilityHint="Opens photo options" onPress={photoOptions} style={styles.photoPanel}>
            {vehicle.heroPhotoUri ? (
              <Image source={{ uri: vehicle.heroPhotoUri }} style={styles.photoPreview} accessibilityLabel={`${vehicle.nickname} hero photo`} />
            ) : (
              <SymbolView
                name={{
                  ios: 'photo.badge.plus',
                  android: 'add_a_photo',
                  web: 'image',
                }}
                tintColor={TorqueColors.primary}
                size={28}
              />
            )}
            <ThemedText style={styles.photoTitle}>{vehicle.heroPhotoUri ? 'Hero photo' : 'Add a hero photo'}</ThemedText>
          </Pressable>
          <View style={styles.fieldGroup}>
            <Field label="Nickname" value={draft.nickname} onChangeText={(nickname) => setDraft({ ...draft, nickname })} />
            <Field label="Year" value={draft.year} onChangeText={(year) => setDraft({ ...draft, year })} keyboardType="number-pad" />
            <Field label="Make" value={draft.make} onChangeText={(make) => setDraft({ ...draft, make })} />
            <Field label="Model" value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} />
          </View>
          <OdometerReadingManager vehicle={vehicle} onChanged={onChanged} />
          <ScheduleManager
            vehicleId={vehicle.id}
            currentOdometerMilliMiles={vehicle.currentOdometerMilliMiles}
            highlightedScheduleId={openScheduleId}
            onHighlightedScheduleOpened={() => {
              scrollView.current?.scrollToEnd({ animated: false });
              onScheduleOpened();
            }}
          />
          {error && (
            <ThemedText style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          )}
          <ActionButton label="Archive vehicle" onPress={archive} />
         </ScrollView>
        <DetailOverlayHeader title="Vehicle profile" leading={{ label: 'Cancel', onPress: onCancel }} trailing={{ label: 'Save', disabled: !valid || saving, onPress: save }} />
    </ThemedView>
  );
}

function TrackingSetupStatus({ vehicleId, vehicleName }: Readonly<{ vehicleId: string; vehicleName: string }>) {
  const [setup, setSetup] = useState<TrackingSetup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useEffectEvent(() => {
    setError(null);
    maintenanceStore.tracking
      .getSetup(vehicleId)
      .then(setSetup)
      .catch((reason: unknown) => {
        setError(reason instanceof Error && reason.message.includes('Rebuild the iOS development client') ? reason.message : 'Automatic tracking setup could not be checked.');
      });
  });
  useEffect(() => {
    const task = setTimeout(load, 0);
    return () => clearTimeout(task);
  }, [vehicleId]);
  if (error)
    return (
      <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
        {error}
      </ThemedText>
    );
  if (!setup) return <ThemedText style={styles.formIntro}>Checking automatic tracking setup...</ThemedText>;
  const requirements = [{ ready: setup.locationReady, title: 'Precise Always Location', done: 'Granted', todo: 'Grant precise, always-on location' }];
  const remaining = requirements.filter((requirement) => !requirement.ready).length;
  const firstIncomplete = requirements.findIndex((requirement) => !requirement.ready);
  const ready = setup.state === 'ready';
  return (
    <View accessibilityLiveRegion="polite" style={styles.setupSection}>
      <View style={[styles.setupBanner, ready ? styles.setupBannerOk : styles.setupBannerWarn]}>
        <View style={styles.setupBannerHead}>
          <View style={[styles.bannerDot, { backgroundColor: ready ? TorqueColors.successDot : TorqueColors.warningDot }]} />
          <ThemedText style={[styles.setupBannerTitle, { color: ready ? TorqueColors.success : TorqueColors.warning }]}>{ready ? 'Automatic tracking ready' : `Not ready — ${remaining} item${remaining === 1 ? '' : 's'} left`}</ThemedText>
        </View>
        <ThemedText style={styles.setupBannerCopy}>{ready ? 'This vehicle can receive its selected Shortcut. Review every captured trip before it affects the estimate.' : `Tracking stays off for ${vehicleName} until the checklist is complete. Manual trips still work.`}</ThemedText>
      </View>
      <SectionLabel>Checklist · {vehicleName}</SectionLabel>
      <Card>
        {requirements.map((requirement, index) => {
          const status: 'done' | 'partial' | 'empty' = requirement.ready ? 'done' : index === firstIncomplete ? 'partial' : 'empty';
          return (
            <View key={requirement.title} style={[styles.checkRow, index < requirements.length - 1 && styles.checkRowDivider]}>
              <CheckIndicator status={status} />
              <View style={styles.checkText}>
                <ThemedText style={styles.checkTitle}>{requirement.title}</ThemedText>
                <ThemedText style={styles.checkSubtitle}>{requirement.ready ? requirement.done : requirement.todo}</ThemedText>
              </View>
            </View>
          );
        })}
      </Card>
      <ThemedText style={styles.setupHint}>Create Bluetooth automations in Apple Shortcuts using this app&apos;s Start Trip and End Trip actions. The app uses Precise Always Location to measure movement while a trip is active.</ThemedText>
    </View>
  );
}

function CheckIndicator({ status }: Readonly<{ status: 'done' | 'partial' | 'empty' }>) {
  const tone = status === 'done' ? TorqueColors.success : status === 'partial' ? TorqueColors.warning : TorqueColors.secondary;
  const surface = status === 'done' ? TorqueColors.successSurface : status === 'partial' ? TorqueColors.warningSurface : TorqueColors.neutralSurface;
  const symbol = status === 'done' ? 'checkmark' : status === 'partial' ? 'minus' : 'circle';
  return (
    <View style={[styles.checkIndicator, { backgroundColor: surface }]}>
      <SymbolView name={symbol} tintColor={tone} size={status === 'empty' ? 8 : 13} weight="bold" />
    </View>
  );
}

function OdometerReadingManager({ vehicle, onChanged }: Readonly<{ vehicle: GarageVehicle; onChanged: () => void }>) {
  const [adding, setAdding] = useState(false);
  const [readings, setReadings] = useState<ManualOdometerReading[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const load = useEffectEvent(() => {
    setLoading(true);
    maintenanceStore.product
      .getManualOdometerReadings(vehicle.id)
      .then(setReadings)
      .catch(() => setError('Odometer history could not be loaded. Try again.'))
      .finally(() => setLoading(false));
  });
  useEffect(() => {
    const task = setTimeout(load, 0);
    return () => clearTimeout(task);
  }, [vehicle.id, reloadKey]);
  if (adding)
    return (
      <OdometerReadingForm
        vehicle={vehicle}
        onCancel={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          setReloadKey((key) => key + 1);
          onChanged();
        }}
      />
    );
  return (
    <View style={styles.odometerSection}>
      <View style={styles.readOnlyRow}>
        <View>
          <ThemedText style={styles.fieldLabel}>Estimated odometer</ThemedText>
          <ThemedText>{formatMiles(vehicle.currentOdometerMilliMiles)} mi</ThemedText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add odometer reading" onPress={() => setAdding(true)}>
          <ThemedText type="linkPrimary">Odometer reading</ThemedText>
        </Pressable>
      </View>
      <ThemedText style={styles.formIntro}>A dashboard reading becomes the current baseline. Earlier trips and maintenance remain unchanged.</ThemedText>
      <ThemedText accessibilityRole="header" style={styles.historyTitle}>
        Odometer history
      </ThemedText>
      {loading ? (
        <ThemedText>Loading odometer history...</ThemedText>
      ) : error ? (
        <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </ThemedText>
      ) : (
        readings.map((reading) => (
          <View key={reading.id} style={styles.historyRow}>
            <ThemedText>{formatDate(reading.effectiveAt)}</ThemedText>
            <ThemedText>{formatMiles(reading.milliMiles)} mi</ThemedText>
          </View>
        ))
      )}
    </View>
  );
}

function OdometerReadingForm({
  vehicle,
  onCancel,
  onSaved,
}: Readonly<{
  vehicle: GarageVehicle;
  onCancel: () => void;
  onSaved: () => void;
}>) {
  const [miles, setMiles] = useState(formatMiles(vehicle.currentOdometerMilliMiles));
  const [date, setDate] = useState(civilToday());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = isMileage(miles) && isCivilDate(date);
  const save = async () => {
    if (!valid) return;
    const submit = async () => {
      setSaving(true);
      setError(null);
      try {
        await maintenanceStore.product.appendManualOdometerReading({
          vehicleId: vehicle.id,
          milliMiles: toMilliMiles(miles),
          effectiveAt: String(new Date(`${date}T12:00:00`).getTime()),
        });
        onSaved();
      } catch {
        setError('The odometer reading could not be saved. Your entry is still here.');
      } finally {
        setSaving(false);
      }
    };
    if (BigInt(toMilliMiles(miles)) < BigInt(vehicle.currentOdometerMilliMiles)) {
      Alert.alert('This reading is lower than your estimate', 'Save it only if the dashboard reading is correct. This adds a new baseline and does not delete prior history.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save lower reading',
          style: 'destructive',
          onPress: () => void submit(),
        },
      ]);
      return;
    }
    await submit();
  };
  return (
    <ThemedView collapsable={false} style={styles.screen}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, styles.detailContent]} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.formIntro}>Enter the dashboard reading. Saving adds an auditable row; it never changes an earlier reading.</ThemedText>
          <View style={styles.fieldGroup}>
            <Field label="Reading date (YYYY-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" error={date && !isCivilDate(date) ? 'Enter a valid calendar date.' : undefined} />
            <Field label="Odometer (mi)" value={miles} onChangeText={setMiles} keyboardType="decimal-pad" error={miles && !isMileage(miles) ? 'Enter a non-negative mileage with up to three decimal places.' : undefined} />
          </View>
          {error ? (
            <ThemedText accessibilityLiveRegion="polite" style={styles.error}>
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
        <DetailOverlayHeader title="Odometer reading" leading={{ label: 'Cancel', onPress: onCancel }} trailing={{ label: 'Save', disabled: !valid || saving, onPress: () => void save() }} />
    </ThemedView>
  );
}

function VehicleForm({
  onCancel,
  onCreated,
}: Readonly<{
  onCancel: () => void;
  onCreated: (vehicle: GarageVehicle) => void;
}>) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof Draft, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string>();
  const validation = validate(draft);

  const choosePhoto = async () => {
    setError(null);
    try {
      setPhotoUri((await chooseHeroPhoto()) ?? undefined);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'The photo could not be selected. Try again.');
    }
  };

  const save = async () => {
    if (validation) return;
    setSaving(true);
    setError(null);
    try {
      const vehicle = await maintenanceStore.product.createVehicle({
        nickname: draft.nickname.trim(),
        year: Number(draft.year),
        make: draft.make.trim(),
        model: draft.model.trim(),
        initialOdometerMilliMiles: toMilliMiles(draft.odometer),
      });
      let savedPhotoUri: string | undefined;
      if (photoUri) {
        try {
          await maintenanceStore.product.replaceHeroPhoto({
            vehicleId: vehicle.id,
            sourceUri: photoUri,
          });
          savedPhotoUri = photoUri;
        } catch {
          savedPhotoUri = undefined;
        }
      }
      onCreated({
        ...vehicle,
        currentOdometerMilliMiles: toMilliMiles(draft.odometer),
        scheduleCount: 0,
        trackingReadiness: 'manual_only',
        heroPhotoUri: savedPhotoUri,
      });
      if (photoUri && !savedPhotoUri) {
        setTimeout(() => Alert.alert('Vehicle saved', 'The vehicle was created, but its photo could not be added. You can add it from the vehicle profile.'), 0);
      }
    } catch {
      setError('The vehicle could not be saved. Your information is still here. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ThemedView collapsable={false} style={styles.screen}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={[styles.content, styles.detailContent]} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="Hero photo" accessibilityHint="Opens the photo library" onPress={() => void choosePhoto()} style={styles.photoPanel}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoPreview} accessibilityLabel="Selected hero photo" />
            ) : (
              <SymbolView
                name={{
                  ios: 'photo.badge.plus',
                  android: 'add_a_photo',
                  web: 'image',
                }}
                tintColor={TorqueColors.primary}
                size={28}
              />
            )}
            <ThemedText style={styles.photoTitle}>{photoUri ? 'Hero photo selected' : 'Add a hero photo'}</ThemedText>
            <ThemedText style={styles.photoDetail}>Optional</ThemedText>
          </Pressable>
          <ThemedText style={styles.formIntro}>Your current odometer is the first authoritative manual baseline.</ThemedText>
          <View style={styles.fieldGroup}>
            <Field label="Nickname" value={draft.nickname} onChangeText={(nickname) => setDraft({ ...draft, nickname })} onBlur={() => setTouched({ ...touched, nickname: true })} error={touched.nickname && !draft.nickname.trim() ? 'Nickname is required.' : undefined} />
            <Field label="Year" value={draft.year} onChangeText={(year) => setDraft({ ...draft, year })} onBlur={() => setTouched({ ...touched, year: true })} keyboardType="number-pad" error={touched.year && (!Number.isInteger(Number(draft.year)) || Number(draft.year) < 1886) ? 'Enter a valid year.' : undefined} />
            <Field label="Make" value={draft.make} onChangeText={(make) => setDraft({ ...draft, make })} onBlur={() => setTouched({ ...touched, make: true })} error={touched.make && !draft.make.trim() ? 'Make is required.' : undefined} />
            <Field label="Model" value={draft.model} onChangeText={(model) => setDraft({ ...draft, model })} onBlur={() => setTouched({ ...touched, model: true })} error={touched.model && !draft.model.trim() ? 'Model is required.' : undefined} />
            <Field label="Odometer (mi)" value={draft.odometer} onChangeText={(odometer) => setDraft({ ...draft, odometer })} onBlur={() => setTouched({ ...touched, odometer: true })} keyboardType="number-pad" error={touched.odometer && !isMileage(draft.odometer) ? 'Enter a non-negative whole number of miles.' : undefined} />
          </View>
          {error && (
            <ThemedText style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          )}
        </ScrollView>
        <DetailOverlayHeader title="Add vehicle" leading={{ label: 'Cancel', onPress: onCancel }} trailing={{ label: 'Save', disabled: Boolean(validation) || saving, onPress: save }} />
    </ThemedView>
  );
}

async function chooseHeroPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 1,
  });
  if (result.canceled) return null;
  const photo = result.assets[0];
  if (!photo) return null;
  if (photo.fileSize && photo.fileSize > 10_000_000) {
    throw new Error('Choose an image smaller than 10 MB.');
  }
  return photo.uri;
}

function Field({ label, error, ...props }: Readonly<{ label: string; error?: string } & React.ComponentProps<typeof TextInput>>) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.fieldLabel}>{label}</ThemedText>
      <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} placeholderTextColor={TorqueColors.secondary} style={styles.input} />
      {error && (
        <ThemedText style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

function ActionButton({ label, onPress, disabled = false }: Readonly<{ label: string; onPress: () => void; disabled?: boolean }>) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, (pressed || disabled) && styles.disabled]}>
      <ThemedText style={styles.actionText}>{label}</ThemedText>
    </Pressable>
  );
}

function validate(draft: Draft) {
  if (!draft.nickname.trim() || !draft.make.trim() || !draft.model.trim()) return 'required';
  if (!Number.isInteger(Number(draft.year)) || Number(draft.year) < 1886) return 'year';
  return isMileage(draft.odometer) ? null : 'odometer';
}

function formatMiles(milliMiles: string) {
  const roundedTenths = (BigInt(milliMiles) + 50n) / 100n;
  const whole = roundedTenths / 10n;
  const tenth = roundedTenths % 10n;
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${wholeText}${tenth === 0n ? '' : `.${tenth}`}`;
}

function formatDate(effectiveAt: string) {
  return new Date(Number(effectiveAt)).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: TorqueColors.canvas },
  content: { paddingVertical: Spacing.four, paddingHorizontal: Spacing.three, gap: Spacing.three },
  detailContent: { paddingTop: detailHeaderContentInset },
  pageTitle: {
    color: TorqueColors.text,
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 480,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: TorqueColors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: TorqueColors.text, fontSize: 20, fontWeight: '700' },
  emptyCopy: {
    color: TorqueColors.secondary,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  list: { gap: Spacing.three },
  addLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addLinkText: { color: TorqueColors.primary, fontSize: 15 },
  trackingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: TorqueColors.card,
    borderRadius: 16,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
  },
  bannerDot: { width: 8, height: 8, borderRadius: 4 },
  bannerBody: { flex: 1, gap: 1 },
  bannerTitle: { color: TorqueColors.text, fontSize: 14, fontWeight: '600' },
  bannerCopy: { color: TorqueColors.secondary, fontSize: 12 },
  vehicleCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: TorqueColors.card,
  },
  vehicleHero: {
    height: 150,
    backgroundColor: TorqueColors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(36, 138, 61, 0.94)',
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 11,
  },
  trackingBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
  trackingBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  vehicleDetails: { padding: Spacing.three, gap: Spacing.two },
  vehicleTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  vehicleTitleText: { flex: 1, gap: 1 },
  vehicleNickname: { color: TorqueColors.secondary, fontSize: 13, fontWeight: '600' },
  vehicleName: { color: TorqueColors.text, fontSize: 17, fontWeight: '600' },
  vehicleModel: { color: TorqueColors.text, fontSize: 16 },
  vehicleMileage: { color: TorqueColors.secondary, fontSize: 13 },
  vehicleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  vehicleMeta: { color: TorqueColors.secondary, fontSize: 15 },
  vehicleMetaStrong: { color: TorqueColors.text, fontSize: 15, fontWeight: '600' },
  vehicleMetaSeparator: { color: TorqueColors.secondary, fontSize: 15, opacity: 0.5 },
  trackingStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  trackingOn: { color: TorqueColors.success },
  sectionTitle: {
    color: TorqueColors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  archivedCard: {
    borderRadius: 16,
    backgroundColor: TorqueColors.card,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  archivedDetails: { gap: Spacing.half },
  readOnlyRow: {
    borderRadius: Spacing.three,
    backgroundColor: TorqueColors.card,
    padding: Spacing.three,
    gap: Spacing.one,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  odometerSection: { gap: Spacing.two },
  historyTitle: {
    color: TorqueColors.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  historyRow: {
    borderRadius: Spacing.two,
    backgroundColor: TorqueColors.card,
    padding: Spacing.two,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  photoPanel: {
    minHeight: 132,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: TorqueColors.divider,
    backgroundColor: TorqueColors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: 132 },
  photoTitle: { color: TorqueColors.primary, fontSize: 16, fontWeight: '600' },
  photoDetail: { color: TorqueColors.secondary, fontSize: 13 },
  formIntro: { color: TorqueColors.secondary, fontSize: 13, lineHeight: 18 },
  fieldGroup: {
    borderRadius: Spacing.three,
    backgroundColor: TorqueColors.card,
    paddingHorizontal: Spacing.three,
  },
  field: {
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TorqueColors.divider,
  },
  fieldLabel: { color: TorqueColors.text, fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 44,
    paddingVertical: Spacing.one,
    fontSize: 17,
    color: TorqueColors.text,
  },
  action: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: TorqueColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  actionText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: TorqueColors.error },
  disabled: { opacity: 0.45 },
  setupSection: { gap: Spacing.two },
  setupBanner: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.one },
  setupBannerWarn: { backgroundColor: TorqueColors.warningSurface, borderColor: TorqueColors.warning },
  setupBannerOk: { backgroundColor: TorqueColors.successSurface, borderColor: TorqueColors.success },
  setupBannerHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  setupBannerTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  setupBannerCopy: { color: TorqueColors.text, fontSize: 13, lineHeight: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 58, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  checkRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: TorqueColors.divider },
  checkIndicator: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  checkText: { flex: 1, gap: 2 },
  checkTitle: { color: TorqueColors.text, fontSize: 16 },
  checkSubtitle: { color: TorqueColors.secondary, fontSize: 13 },
  setupHint: { color: TorqueColors.secondary, fontSize: 12.5, lineHeight: 18, paddingHorizontal: Spacing.three },
});
