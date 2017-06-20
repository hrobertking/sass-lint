'use strict';

var helpers = require('../helpers');

module.exports = {
  'name': 'accessibility-issues',
  'defaults': {
    'per-property': {},
    'global': []
  },
  'detect': function (ast, parser) {
    var result = [],
        // minimum brightness difference
        BRIGHTNESS = 126,
        // minimum hue difference
        HUE = 501,
        // content hiding methods that hide content from assistive technology
        HIDDEN_DISALLOWED = {
          'display': ['none'],
          'height': ['0'],
          'overflow': ['hidden'],
          'visibility': ['hidden'],
          'width': ['0']
        },
        // using absolute units for font-size, margin, or padding causes issues related to visual acuity
        UNITS_ALLOWED = {
          'font-size': ['em', 'rem'],
          'margin': ['em', 'rem'],
          'padding': ['em', 'rem']
        };

    // validates a color object
    var color = function (colorDef) {
      return (colorDef ? !isNaN(colorDef.red) && !isNaN(colorDef.green) && !isNaN(colorDef.blue) : false);
    };

    // calculate the brightness of a color
    var colorBrightness = function (cd) {
      var value;

      if (color(cd)) {
        value = (299 * cd.red) + (587 * cd.green) + (114 * cd.blue);
        value = value / 1000;
      }

      return value;
    };

    // calculate the hue difference in color
    var colorHue = function (fg, bg) {
      var value;

      if (color(fg) && color(bg)) {
        value = Math.abs(fg.red - bg.red) +
                Math.abs(fg.green - bg.green) +
                Math.abs(fg.blue - bg.blue);
      }

      return value;
    };

    // traverse by ruleset - it's the only way to get access to both the selector *and* the properties
    ast.traverseByType('ruleset', function (ruleset) {
      ruleset.forEach('block', function (block, index, parent) {
        // pseudoelements aren't available to AT, so we don't need to apply rules to them
        var isActive = false,
            isAfter = false,
            isBefore = false,
            isFocus = false,
            isHover = false;

        var bgcolor,
            fgcolor,
            brightness,
            hue;

        // evaluate the selector(s) to see if we're dealing a "real" element
        parent.forEach('selector', function (selector) {
          selector.forEach('pseudoClass', function (pseudo) {
            var ident = pseudo.first('ident') || null,
                type = ident ? ident.content : null;

            if (type === 'active') {
              isActive = true;
            }
            if (type === 'after') {
              isAfter = true;
            }
            if (type === 'before') {
              isBefore = true;
            }
            if (type === 'focus') {
              isFocus = true;
            }
            if (type === 'hover') {
              isHover = true;
            }
          });
        });

        // run device-dependent issues
        if ((isActive || isFocus || isHover) && !(isActive && isFocus && isHover)) {
          result = helpers.addUnique(result, {
            'ruleId': parser.rule.name,
            'severity': parser.severity,
            'line': ruleset.start.line,
            'column': ruleset.start.column,
            'message': 'Use of :hover, :active, or :focus without all three creates device dependence'
          });
        }

        block.forEach('declaration', function (node) {
          var property = node.first('property'),
              ident = property ? property.first('ident') : null,
              propertyName = ident ? ident.content : null,
              valueNode = node.first('value'),
              hasDimension = valueNode ? !!valueNode.first('dimension') : null,
              isPseudoElement = !(isAfter || isBefore);

          var colorize = function () {
            var colorDef = { red: '', green: '', blue: '' },
                hex6 = /^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i,
                hex3 = /^([0-9a-f]{1})([0-9a-f]{1})([0-9a-f]{1})$/i,
                colorNode = valueNode.first('color'),
                args = valueNode.first('function');

            if (colorNode) {
              // ignore variable types
              colorNode = colorNode.content;

              hex6 = hex6.exec(colorNode);
              hex3 = hex3.exec(colorNode);

              // adjust for 3-digit hex shorthand
              if (hex3) {
                hex3[1] += hex3[1];
                hex3[2] += hex3[2];
                hex3[3] += hex3[3];
              }

              if (hex3 || hex6) {
                colorDef.red = parseInt((hex3 || hex6)[1], 16);
                colorDef.green = parseInt((hex3 || hex6)[2], 16);
                colorDef.blue = parseInt((hex3 || hex6)[3], 16);
              }
            }
            else if (args) {
              args.first('arguments').forEach(function (arg) {
                if (arg.is('number')) {
                  if (colorDef.red === '') {
                    colorDef.red = parseInt(arg.content, 10);
                  }
                  else if (colorDef.green === '') {
                    colorDef.green = parseInt(arg.content, 10);
                  }
                  else if (colorDef.blue === '') {
                    colorDef.blue = parseInt(arg.content, 10);
                  }
                }
              });
            }

            return colorDef;
          };

          // set fgcolor
          if (propertyName === 'color') {
            fgcolor = colorize();
          }

          // set bgcolor
          if (propertyName === 'background-color') {
            bgcolor = colorize();
          }
          if (propertyName === 'background') {
            bgcolor = colorize();
          }

          // run content in CSS is is unavailable issue
          if (propertyName === 'content' && valueNode.toString().replace(/^\s*|\s*$/g, '') && !isPseudoElement) {
            result = helpers.addUnique(result, {
              'ruleId': parser.rule.name,
              'severity': parser.severity,
              'line': node.start.line,
              'column': node.start.column,
              'message': 'Content specified in a stylesheet is not available to assistive technology'
            });
          }

          // run discoverability cognitive issues
          if (propertyName === 'position' && ['absolute'].indexOf(valueNode.toString()) > -1) {
            result = helpers.addUnique(result, {
              'ruleId': parser.rule.name,
              'severity': parser.severity,
              'line': node.start.line,
              'column': node.start.column,
              'message': 'Absolutely positioned content poses discoverability issues'
            });
          }

          // run focus cue missing issue
          if (propertyName === 'outline' && ['none', '0'].indexOf(valueNode.toString()) > -1) {
            result = helpers.addUnique(result, {
              'ruleId': parser.rule.name,
              'severity': parser.severity,
              'line': node.start.line,
              'column': node.start.column,
              'message': 'Outline should not be hidden'
            });
          }

          // run inaccessible content issues
          if (propertyName && HIDDEN_DISALLOWED[propertyName]) {
            if (HIDDEN_DISALLOWED[propertyName].indexOf(valueNode.toString()) !== -1) {
              result = helpers.addUnique(result, {
                'ruleId': parser.rule.name,
                'severity': parser.severity,
                'line': node.start.line,
                'column': node.start.column,
                'message': 'Content hidden by setting \'' + propertyName + '\' to \'' + valueNode + '\' is not available to assistive technology'
              });
            }
          }

          // run visual acuity issues
          if (propertyName && hasDimension) {
            valueNode.forEach('dimension', function (dimension) {
              var dimensionIdent = dimension ? dimension.first('ident') : null,
                  propUnitType = dimensionIdent ? dimensionIdent.content : null,
                  propUnitsAllowed = UNITS_ALLOWED[propertyName];

              // if a property is defined in with units allowed, then only invalidate those unit types not defined
              if (propUnitType && propUnitsAllowed) {
                if (propUnitsAllowed.indexOf(propUnitType) === -1) {
                  result = helpers.addUnique(result, {
                    'ruleId': parser.rule.name,
                    'severity': parser.severity,
                    'line': dimension.start.line,
                    'column': dimension.start.column,
                    'message': 'Values for property \'' + propertyName + '\' may only be specified as ' + propUnitsAllowed.join(', ')
                  });
                }
              }
            });
          }
        });

        // run color issues
        if (color(bgcolor) && !color(fgcolor)) {
          result = helpers.addUnique(result, {
            'ruleId': parser.rule.name,
            'severity': parser.severity,
            'line': block.start.line,
            'column': block.start.column,
            'message': 'Color should always be specified any time background-color is defined'
          });
        }
        else if (color(bgcolor) && color(fgcolor)) {
          brightness = Math.abs(colorBrightness(bgcolor) - colorBrightness(fgcolor));
          hue = colorHue(fgcolor, bgcolor);

          if (brightness < BRIGHTNESS || hue < HUE) {
            result = helpers.addUnique(result, {
              'ruleId': parser.rule.name,
              'severity': parser.severity,
              'line': block.start.line,
              'column': block.start.column,
              'message': 'There is not enough contrast between background and foreground colors'
            });
          }
        }
      });
    });

    return result;
  }
};
