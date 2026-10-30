// File/folder icons from Material Icon Theme (PKief, MIT). Only the name rules are bundled (this
// module is loaded lazily by Tree.jsx); each SVG is fetched from /icons/<icon>.svg when a row shows
// it, so files that appear later resolve the same way.
import { fileExtensions, fileNames, folderNames } from 'material-icon-theme/dist/material-icons.json'
import { iconRules } from './iconRules.js'

export const { fileIcon, folderIcon } = iconRules({ fileNames, fileExtensions, folderNames })
