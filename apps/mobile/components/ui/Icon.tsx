import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
type MaterialName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type FeatherName = React.ComponentProps<typeof Feather>['name'];

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  library?: 'ionicons' | 'material' | 'feather';
}

export function Icon({
  name,
  size = 24,
  color = '#111827',
  library = 'ionicons',
}: IconProps) {
  if (library === 'material') {
    return (
      <MaterialCommunityIcons
        name={name as MaterialName}
        size={size}
        color={color}
      />
    );
  }
  if (library === 'feather') {
    return <Feather name={name as FeatherName} size={size} color={color} />;
  }
  return <Ionicons name={name as IoniconsName} size={size} color={color} />;
}