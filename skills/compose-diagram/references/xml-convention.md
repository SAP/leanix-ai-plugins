# XML Convention (Read-Only Reference)

Underneath, every diagram is draw.io (mxGraph) XML. You never see or write the full XML: mutation tools return only a **diff** (`addedCells`, `removedCells`, `cellModifications`) whose entries are individual mxGraph cells, because re-returning a large diagram's XML on every call would blow the context. Use this reference to interpret those diff cell shapes — to read a cell's `id`, its `parent` (nesting), `source`/`target` (edges), style, and structure — so you can pass correct parameters to follow-up tool calls. You never compose or modify XML directly.

## Document Skeleton

Every LeanIX diagram XML follows this mxGraphModel structure:

```xml
<mxGraphModel lxXmlVersion="1">
  <root>
    <lx-settings id="0"><mxCell /></lx-settings>
    <mxCell id="1" parent="0" />
    <!-- All fact sheet cells and edges here with parent="1" -->
  </root>
</mxGraphModel>
```

- `<lx-settings id="0">` — settings node with a child `<mxCell />` (NOT self-closing)
- `<mxCell id="1" parent="0" />` — default layer (root parent for top-level cells)
- Content cell IDs start from `"2"` and increment
- `lxXmlVersion="1"` is required on `<mxGraphModel>`

## Cell Anatomy

Every visible element is either a **vertex** (shape/node) or an **edge** (connector). Both are `mxCell` elements, optionally wrapped in `<object>` for metadata.

| Attribute | Meaning |
|---|---|
| `id` | Unique cell identifier — use this in tool calls |
| `vertex="1"` | This cell is a shape |
| `edge="1"` | This cell is a connector |
| `parent` | ID of containing cell (`"1"` = top-level, or a container ID) |
| `source` / `target` | For edges: cell IDs of connected vertices |
| `value` or `label` | Display text (on `<object>` wrapper: `label`; on plain `mxCell`: `value`) |

## LeanIX Fact Sheet Cell

```xml
<object type="factSheet" label="{name}" factSheetType="{Type}" factSheetId="{uuid}" id="{cellId}">
  <mxCell style="leanix_fs_{Type}" vertex="1" parent="1">
    <mxGeometry x="{x}" y="{y}" width="80" height="45" as="geometry" />
  </mxCell>
</object>
```

- `factSheetType`: PascalCase — `Application`, `ITComponent`, `BusinessCapability`, `TechnicalStack`, `DataObject`, `Provider`, `Process`, `UserGroup`, `Project`, `Interface`
- `factSheetId`: LeanIX UUID — use this to correlate with API data
- `parent="1"` = top-level; `parent="{containerId}"` = nested (coordinates become relative)

## Style System

Styles are semicolon-separated key-value pairs in the `style` attribute. LeanIX uses named styles that resolve from workspace configuration.

### LeanIX Named Styles

| Pattern | Purpose |
|---|---|
| `leanix_fs_{Type}` | Standard fact sheet cell |
| `leanix_fs_container_{Type};` | Container that holds child cells (note trailing `;`) |
| `leanix_fs_flex_container_{Type}` | Flex container variant |
| `leanix_color_{Type}` | Color-only variant |
| `leanix_drilldown_scope` | Appended to children of an expanded/drilled-down node |
| `leanix_dependency` | Edge style for relation connectors |

### General draw.io Style Properties

Styles are semicolon-separated `key=value` pairs (e.g., `rounded=1;fillColor=#dae8fc;strokeColor=#6c8ebf;`). Keywords without `=` are shape identifiers (e.g., `ellipse;`).

#### Shape & Container

| Property | Values | Meaning |
|---|---|---|
| `rounded` | 0 or 1 | Rounded corners on rectangles |
| `shape` | See shape catalog below | Domain-specific shapes |
| `ellipse` | keyword | Render as circle/oval |
| `rhombus` | keyword | Diamond decision node |
| `swimlane` | keyword | Container with titled header bar |
| `container` | 0 or 1 | Enable containment behavior on any shape |
| `group` | keyword | Invisible container (auto-sets `pointerEvents=0`) |
| `collapsible` | 0 or 1 | Allow container collapse/expand |
| `startSize` | number (px) | Header height (swimlane: 30–110; nested: 24) |
| `horizontal` | 0 or 1 | Swimlane orientation; 0 = vertical title bar |
| `pointerEvents` | 0 or 1 | Whether container captures child connections |
| `childLayout` | `tableLayout` | Auto-arrange children (tables) |
| `arcSize` | number | Corner radius when `rounded=1` |
| `direction` | `north`, `south`, `east`, `west` | Shape direction/rotation |
| `flipH` | 0 or 1 | Flip horizontally |
| `flipV` | 0 or 1 | Flip vertically |
| `rotation` | degrees | Rotation angle |

#### Shape Catalog (`shape=` values)

**Core mxGraph shapes** (use as keyword without `shape=`): `ellipse`, `rhombus`, `triangle`, `hexagon`, `cloud`, `cylinder`, `line`, `arrow`, `doubleEllipse`, `swimlane`, `actor`, `label`.

**Extended draw.io shapes** (use as `shape=<name>`):

| Category | Shapes |
|---|---|
| Containers | `cube`, `isoCube`, `isoCube2`, `isoRectangle`, `folder`, `note`, `note2`, `card` |
| Data/Storage | `cylinder2`, `cylinder3`, `datastore`, `dataStorage`, `internalStorage` |
| Documents | `document`, `tape`, `tapeData` |
| Flow/Process | `process`, `process2`, `step`, `plus`, `manualInput`, `loopLimit`, `offPageConnector`, `delay`, `display` |
| Arrows/Lines | `singleArrow`, `doubleArrow`, `flexArrow`, `wire`, `waypoint`, `filledEdge`, `zigzag` |
| Connectors | `curlyBracket`, `corner`, `crossbar`, `tee`, `link`, `pipe` |
| Logic/Math | `or`, `orEllipse`, `xor`, `sumEllipse`, `sortShape`, `collate`, `cross` |
| Geometry | `parallelogram`, `trapezoid`, `ext`, `callout`, `switch`, `partialRectangle`, `lineEllipse`, `dimension` |
| Tables | `table`, `tableRow`, `tableLine` |
| Misc | `transparent`, `message`, `rect2` |

**UML shapes** (`shape=<name>`): `umlActor`, `umlBoundary`, `umlEntity`, `umlDestroy`, `umlControl`, `umlLifeline`, `umlFrame`, `umlState`, `lollipop`, `requires`, `requiredInterface`, `providedRequiredInterface`, `module`, `component`, `associativeEntity`, `endState`, `startState`.

#### Color & Visual

| Property | Values | Meaning |
|---|---|---|
| `fillColor` | `#HEX` or `default` | Background color; `default` adapts to light/dark theme |
| `gradientColor` | `#HEX` | Gradient end color (fills top-to-bottom by default) |
| `gradientDirection` | `north`, `south`, `east`, `west` | Gradient direction |
| `strokeColor` | `#HEX` or `default` | Border color; `default` auto-adapts |
| `strokeWidth` | number | Border thickness in pixels |
| `dashed` | 0 or 1 | Dashed stroke |
| `dashPattern` | space-separated numbers | Custom dash pattern (e.g., `8 4`) |
| `opacity` | 0–100 | Overall opacity |
| `fillOpacity` | 0–100 | Fill-only opacity |
| `strokeOpacity` | 0–100 | Stroke-only opacity |
| `glass` | 0 or 1 | Glass/glossy effect overlay |
| `shadow` | 0 or 1 | Drop shadow |

#### Text & Typography

| Property | Values | Meaning |
|---|---|---|
| `whiteSpace` | `wrap` | Enable text wrapping |
| `html` | 0 or 1 | Enable HTML rendering in labels (`<b>`, `<br>`, etc.). When set, a cell's `value` may hold literal HTML to style its text — pass it raw (`<b>SAP</b>`), NEVER double-escaped (`&lt;b&gt;`). |
| `fontStyle` | 1 (bold), 2 (italic), 4 (underline) | Text formatting; combine via bitwise OR (e.g., 3 = bold+italic) |
| `fontSize` | number | Font size in points |
| `fontFamily` | font name | Font family (e.g., `Helvetica`, `Courier New`) |
| `fontColor` | `#HEX` or `light-dark(#light,#dark)` | Text color; supports dual-theme syntax |
| `align` | `left`, `center`, `right` | Horizontal text alignment |
| `verticalAlign` | `top`, `middle`, `bottom` | Vertical text alignment |
| `labelPosition` | `left`, `center`, `right` | Label horizontal position relative to shape |
| `verticalLabelPosition` | `top`, `middle`, `bottom` | Label vertical position relative to shape |
| `overflow` | `fill`, `hidden`, `visible`, `width` | Text overflow behavior |
| `spacing` | number | Overall label padding (px) |
| `spacingTop` | number | Top padding |
| `spacingBottom` | number | Bottom padding |
| `spacingLeft` | number | Left padding |
| `spacingRight` | number | Right padding |
| `labelBackgroundColor` | `#HEX` | Background color behind label text |
| `labelBorderColor` | `#HEX` | Border around label text |

#### Edge (Connector) Styles

| Property | Values | Meaning |
|---|---|---|
| `edgeStyle` | `orthogonalEdgeStyle`, `elbowEdgeStyle`, `entityRelationEdgeStyle`, `segmentEdgeStyle`, `isometricEdgeStyle`, `loopEdgeStyle`, `sideToSideEdgeStyle`, `topToBottomEdgeStyle` | Routing algorithm |
| `curved` | 1 | Smooth curved connectors |
| `elbow` | `vertical`, `horizontal` | Elbow direction (with `elbowEdgeStyle`) |
| `jettySize` | number or `auto` | Minimum segment length for orthogonal routing |
| `orthogonalLoop` | 0 or 1 | Allow orthogonal self-loops |
| `jumpStyle` | `arc`, `gap`, `sharp`, `line` | Line crossing style |
| `jumpSize` | number | Size of line crossing jumps |

**Arrow types** (for `startArrow` and `endArrow`):

`none`, `classic`, `classicThin`, `block`, `blockThin`, `open`, `openThin`, `oval`, `diamond`, `diamondThin`, `box`, `halfCircle`, `circle`, `circlePlus`, `cross`, `baseDash`, `doubleBlock`, `dash`, `async`, `openAsync`, `manyOptional`.

| Property | Values | Meaning |
|---|---|---|
| `endArrow` | arrow type | Arrow head at target |
| `startArrow` | arrow type | Arrow head at source |
| `endSize` | number | Target arrow size (default 6) |
| `startSize` | number | Source arrow size |
| `endFill` | 0 or 1 | Whether target arrow is filled |
| `startFill` | 0 or 1 | Whether source arrow is filled |

## Containment (Parent-Child)

Children set `parent="{containerId}"` and use coordinates **relative to the container**. Visual nesting IS the relationship — no edges needed between container and children.

Container cells have `<mxRectangle>` with `as="alternateBounds"` inside geometry for collapse/expand.

## Edges

Edges connect two vertices via `source` and `target` cell IDs. Every edge must contain a child `<mxGeometry relative="1" as="geometry" />`.

Simple edge:

```xml
<mxCell id="{edgeId}" edge="1" source="{sourceCellId}" target="{targetCellId}" parent="1">
  <mxGeometry relative="1" as="geometry" />
</mxCell>
```

LeanIX relation edge (with metadata):

```xml
<object type="relation" dependencyRelation="{relationType}"
  relationId="{relationUuid}"
  sourceFactSheetId="{sourceUuid}" targetFactSheetId="{targetUuid}" id="{edgeId}">
  <mxCell style="leanix_dependency" parent="1" source="{sourceCellId}" target="{targetCellId}" edge="1">
    <mxGeometry relative="1" as="geometry" />
  </mxCell>
</object>
```

Edge routing is automatic — draw.io's ELK engine handles bend points and connection points after render.

## Grid Layout

Default spacing for non-overlapping layouts:

```
Cell: 80×45 px | hGap: 20 px | vGap: 15 px | Start: x=20, y=20
x = 20 + (col × 100)   // 100 = width(80) + hGap(20)
y = 20 + (row × 60)    //  60 = height(45) + vGap(15)
```

Inside containers: x = 10 + (col × 100), y = 45 + (row × 65).

## XML Escaping

Special characters in attribute values MUST be XML-escaped:

| Character | Escape |
|---|---|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |

The `&` character is the most common source of broken diagrams — entity names like "Small & Medium Online Business" appear as `Small &amp; Medium Online Business` in labels.

## Layers and Tags

- **Layers**: Additional `mxCell` elements with `parent="0"` (no `vertex`/`edge`). Cells belong to a layer via their `parent` attribute. Later layers render on top.
- **Tags**: Assigned via `tags` attribute on `<object>` wrappers as space-separated strings. Used for visual filtering — a cell can have multiple tags.
