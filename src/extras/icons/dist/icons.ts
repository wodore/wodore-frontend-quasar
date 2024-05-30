export type IconsId =
  | 'text-outline'
  | 'question-mark'
  | 'more-vertical'
  | 'message'
  | 'menu'
  | 'menu-arrow'
  | 'location-question'
  | 'link'
  | 'favorite'
  | 'favorite-outline'
  | 'eye'
  | 'eye-outline'
  | 'edit'
  | 'edit-outline'
  | 'close'
  | 'checkmark'
  | 'calendar'
  | 'at'
  | 'arrowhead-up'
  | 'arrowhead-down'
  | 'arrow-up-down'
  | 'add'
  | 'add-outline';

export type IconsKey =
  | 'TextOutline'
  | 'QuestionMark'
  | 'MoreVertical'
  | 'Message'
  | 'Menu'
  | 'MenuArrow'
  | 'LocationQuestion'
  | 'Link'
  | 'Favorite'
  | 'FavoriteOutline'
  | 'Eye'
  | 'EyeOutline'
  | 'Edit'
  | 'EditOutline'
  | 'Close'
  | 'Checkmark'
  | 'Calendar'
  | 'At'
  | 'ArrowheadUp'
  | 'ArrowheadDown'
  | 'ArrowUpDown'
  | 'Add'
  | 'AddOutline';

export enum Icons {
  TextOutline = 'text-outline',
  QuestionMark = 'question-mark',
  MoreVertical = 'more-vertical',
  Message = 'message',
  Menu = 'menu',
  MenuArrow = 'menu-arrow',
  LocationQuestion = 'location-question',
  Link = 'link',
  Favorite = 'favorite',
  FavoriteOutline = 'favorite-outline',
  Eye = 'eye',
  EyeOutline = 'eye-outline',
  Edit = 'edit',
  EditOutline = 'edit-outline',
  Close = 'close',
  Checkmark = 'checkmark',
  Calendar = 'calendar',
  At = 'at',
  ArrowheadUp = 'arrowhead-up',
  ArrowheadDown = 'arrowhead-down',
  ArrowUpDown = 'arrow-up-down',
  Add = 'add',
  AddOutline = 'add-outline',
}

export const ICONS_CODEPOINTS: { [key in Icons]: string } = {
  [Icons.TextOutline]: '61697',
  [Icons.QuestionMark]: '61698',
  [Icons.MoreVertical]: '61699',
  [Icons.Message]: '61700',
  [Icons.Menu]: '61701',
  [Icons.MenuArrow]: '61702',
  [Icons.LocationQuestion]: '61703',
  [Icons.Link]: '61704',
  [Icons.Favorite]: '61705',
  [Icons.FavoriteOutline]: '61706',
  [Icons.Eye]: '61707',
  [Icons.EyeOutline]: '61708',
  [Icons.Edit]: '61709',
  [Icons.EditOutline]: '61710',
  [Icons.Close]: '61711',
  [Icons.Checkmark]: '61712',
  [Icons.Calendar]: '61713',
  [Icons.At]: '61714',
  [Icons.ArrowheadUp]: '61715',
  [Icons.ArrowheadDown]: '61716',
  [Icons.ArrowUpDown]: '61717',
  [Icons.Add]: '61718',
  [Icons.AddOutline]: '61719',
};
