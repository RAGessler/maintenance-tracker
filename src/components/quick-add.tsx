import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { BottomSheet, Button, Divider, Group, Host, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  foregroundStyle,
  labelStyle,
  padding,
  presentationBackground,
  presentationDragIndicator,
  shapes,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import { TorqueColors } from '@/constants/theme';
import { type GarageVehicle } from '../../modules/maintenance-store';

type SheetContent = 'actions' | 'vehicles';
type PendingAction = 'record' | 'trip' | Readonly<{ odometerVehicleId: string }>;

const actionTones = {
  maintenance: { foreground: TorqueColors.success, background: TorqueColors.successSurface },
  odometer: { foreground: TorqueColors.warning, background: TorqueColors.warningSurface },
  trip: { foreground: TorqueColors.trip, background: TorqueColors.tripSurface },
} as const;

/** Native iOS Quick Add presentation from the TorqueLog Alpha flow. */
export function QuickAddFab({ vehicles }: Readonly<{ vehicles: GarageVehicle[] }>) {
  const [isPresented, setIsPresented] = useState(false);
  const [content, setContent] = useState<SheetContent>('actions');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [openVehiclePickerAfterDismiss, setOpenVehiclePickerAfterDismiss] = useState(false);

  if (vehicles.length === 0) return null;

  const queue = (action: PendingAction) => {
    setPendingAction(action);
    setIsPresented(false);
  };

  const handleDismiss = () => {
    if (openVehiclePickerAfterDismiss) {
      setOpenVehiclePickerAfterDismiss(false);
      setIsPresented(true);
      return;
    }

    const action = pendingAction;
    setPendingAction(null);
    setContent('actions');
    if (action === 'record') {
      router.navigate({ pathname: '/activity', params: { quickAdd: 'record' } });
    } else if (action === 'trip') {
      router.navigate('/activity');
    } else if (action) {
      router.navigate({ pathname: '/', params: { vehicleId: action.odometerVehicleId, quickAdd: 'odometer' } });
    }
  };

  const openOdometer = () => {
    if (vehicles.length === 1) {
      queue({ odometerVehicleId: vehicles[0].id });
      return;
    }
    setContent('vehicles');
    setOpenVehiclePickerAfterDismiss(true);
    setIsPresented(false);
  };

  return (
    <Host matchContents style={styles.host} seedColor={TorqueColors.primary}>
      <VStack alignment="trailing">
        <Button
          label="Quick Add"
          systemImage="plus"
          onPress={() => setIsPresented(true)}
          modifiers={[
            buttonStyle('glassProminent'),
            buttonBorderShape('circle'),
            controlSize('extraLarge'),
            labelStyle('iconOnly'),
            tint(TorqueColors.primary),
          ]}
        />
        <BottomSheet
          isPresented={isPresented}
          onIsPresentedChange={setIsPresented}
          onDismiss={handleDismiss}
          fitToContents>
          <Group modifiers={[presentationBackground('#F2F2F7'), presentationDragIndicator('visible')]}> 
            {content === 'actions' ? (
              <ActionMenu onClose={() => setIsPresented(false)} onMaintenance={() => queue('record')} onOdometer={openOdometer} onTrip={() => queue('trip')} />
            ) : (
              <VehicleMenu vehicles={vehicles} onBack={() => setContent('actions')} onClose={() => setIsPresented(false)} onVehicle={(vehicleId) => queue({ odometerVehicleId: vehicleId })} />
            )}
          </Group>
        </BottomSheet>
      </VStack>
    </Host>
  );
}

function ActionMenu({
  onClose,
  onMaintenance,
  onOdometer,
  onTrip,
}: Readonly<{
  onClose: () => void;
  onMaintenance: () => void;
  onOdometer: () => void;
  onTrip: () => void;
}>) {
  return (
    <VStack spacing={12} modifiers={[padding({ top: 4, bottom: 24, horizontal: 16 })]}>
      <SheetHeader title="Quick Add" onClose={onClose} />
      <VStack spacing={0} modifiers={[background(TorqueColors.card, shapes.roundedRectangle({ cornerRadius: 14 }))]}>
        <ActionRow label="Log maintenance" symbol="wrench.and.screwdriver.fill" tone="maintenance" onPress={onMaintenance} />
        <Divider />
        <ActionRow label="Odometer reading" subtitle="Sets a new baseline" symbol="gauge.with.needle" tone="odometer" onPress={onOdometer} />
        <Divider />
        <ActionRow label="Start trip manually" symbol="point.topleft.down.curvedto.point.bottomright.up" tone="trip" onPress={onTrip} />
      </VStack>
    </VStack>
  );
}

function VehicleMenu({
  vehicles,
  onBack,
  onClose,
  onVehicle,
}: Readonly<{
  vehicles: GarageVehicle[];
  onBack: () => void;
  onClose: () => void;
  onVehicle: (vehicleId: string) => void;
}>) {
  return (
    <VStack spacing={12} modifiers={[padding({ top: 4, bottom: 24, horizontal: 16 })]}>
      <HStack>
        <Button label="Back" systemImage="chevron.backward" onPress={onBack} modifiers={[buttonStyle('plain'), labelStyle('iconOnly')]} />
        <Spacer />
        <Text modifiers={[font({ textStyle: 'headline' })]}>Odometer reading</Text>
        <Spacer />
        <CloseButton onPress={onClose} />
      </HStack>
      <VStack spacing={0} modifiers={[background(TorqueColors.card, shapes.roundedRectangle({ cornerRadius: 14 }))]}>
        {vehicles.map((vehicle, index) => (
          <VStack key={vehicle.id} spacing={0}>
            <VehicleRow vehicle={vehicle} onPress={() => onVehicle(vehicle.id)} />
            {index < vehicles.length - 1 ? <Divider /> : null}
          </VStack>
        ))}
      </VStack>
    </VStack>
  );
}

function SheetHeader({ title, onClose }: Readonly<{ title: string; onClose: () => void }>) {
  return (
    <HStack>
      <Text modifiers={[font({ textStyle: 'title3', weight: 'bold' })]}>{title}</Text>
      <Spacer />
      <CloseButton onPress={onClose} />
    </HStack>
  );
}

function CloseButton({ onPress }: Readonly<{ onPress: () => void }>) {
  return <Button label="Close Quick Add" systemImage="xmark" onPress={onPress} modifiers={[buttonStyle('bordered'), buttonBorderShape('circle'), controlSize('small'), labelStyle('iconOnly'), tint(TorqueColors.secondary)]} />;
}

function ActionRow({
  label,
  subtitle,
  symbol,
  tone,
  onPress,
}: Readonly<{
  label: string;
  subtitle?: string;
  symbol: 'wrench.and.screwdriver.fill' | 'gauge.with.needle' | 'point.topleft.down.curvedto.point.bottomright.up';
  tone: keyof typeof actionTones;
  onPress: () => void;
}>) {
  const colors = actionTones[tone];
  return (
    <Button onPress={onPress} modifiers={[buttonStyle('plain'), padding({ vertical: 12, horizontal: 16 })]}>
      <HStack spacing={12} alignment="center">
        <Image systemName={symbol} size={18} color={colors.foreground} modifiers={[background(colors.background, shapes.roundedRectangle({ cornerRadius: 8 })), padding({ all: 7 })]} />
        <VStack spacing={2} alignment="leading">
          <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(TorqueColors.text)]}>{label}</Text>
          {subtitle ? <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(TorqueColors.secondary)]}>{subtitle}</Text> : null}
        </VStack>
        <Spacer />
        <Image systemName="chevron.right" size={13} color={TorqueColors.secondary} />
      </HStack>
    </Button>
  );
}

function VehicleRow({ vehicle, onPress }: Readonly<{ vehicle: GarageVehicle; onPress: () => void }>) {
  return (
    <Button onPress={onPress} modifiers={[buttonStyle('plain'), padding({ vertical: 12, horizontal: 16 })]}>
      <HStack spacing={12} alignment="center">
        <Image systemName="car.fill" size={18} color={TorqueColors.primary} modifiers={[background(TorqueColors.primarySurface, shapes.roundedRectangle({ cornerRadius: 8 })), padding({ all: 7 })]} />
        <VStack spacing={2} alignment="leading">
          <Text modifiers={[font({ textStyle: 'body' }), foregroundStyle(TorqueColors.text)]}>{vehicle.nickname}</Text>
          <Text modifiers={[font({ textStyle: 'caption' }), foregroundStyle(TorqueColors.secondary)]}>{formatMileage(vehicle.currentOdometerMilliMiles)} mi est.</Text>
        </VStack>
        <Spacer />
        <Image systemName="chevron.right" size={13} color={TorqueColors.secondary} />
      </HStack>
    </Button>
  );
}

function formatMileage(milliMiles: string) {
  const miles = BigInt(milliMiles);
  const whole = miles / 1_000n;
  const fraction = (miles % 1_000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}${fraction ? `.${fraction}` : ''}`;
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    zIndex: 6,
  },
});
