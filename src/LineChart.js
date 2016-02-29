import React, { PropTypes, Component } from 'react';
import d3 from 'd3/d3.min.js';
import Chart from './Chart';
import Axis from './Axis';
import Path from './Path';
import Tooltip from './Tooltip';
import * as helpers from './helpers.js';
import ReactDOM from 'react-dom';
import ReactDOMServer from 'react-dom/server';

class LineChart extends Component {

  static propTypes = {
    children: PropTypes.arrayOf(PropTypes.object),
    colorScale: PropTypes.func,
    data: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.array
    ]).isRequired,
    defined: PropTypes.func,
    height: PropTypes.number.isRequired,
    interpolate: PropTypes.string,
    label: PropTypes.func,
    legend: PropTypes.object,
    xAxis: PropTypes.object,
    yAxis: PropTypes.object,
    margin: PropTypes.shape({
      top: PropTypes.number,
      bottom: PropTypes.number,
      left: PropTypes.number,
      right: PropTypes.number
    }),
    stroke: PropTypes.object,
    tooltipHtml: PropTypes.func,
    tooltipMode: PropTypes.oneOf(['mouse', 'element', 'fixed']),
    tooltipClassName: PropTypes.string,
    tooltipContained: PropTypes.bool,
    tooltipOffset: PropTypes.objectOf(PropTypes.number),
    values: PropTypes.func,
    width: PropTypes.number.isRequired,
    x: PropTypes.func,
    xScale: PropTypes.func,
    y: PropTypes.func,
    y0: PropTypes.func,
    yScale: PropTypes.func
  };

  static defaultProps = {
    colorScale: d3.scale.category20(),
    data: {label: 'No data available', values: [{x: 'No data available', y: 1}]},
    interpolate: 'linear',
    label: stack => { return stack.label; },
    defined: () => true,
    margin: {top: 0, bottom: 0, left: 0, right: 0},
    shape: 'circle',
    shapeColor: null,
    stroke: {},
    tooltipMode: 'mouse',
    tooltipOffset: {top: -35, left: 0},
    tooltipClassName: null,
    tooltipHtml: null,
    tooltipContained: false,
    values: stack => { return stack.values; },
    x: e => { return e.x; },
    xScale: null,
    y: e => { return e.y; },
    y0: () => { return 0; },
    yScale: null
  };

  constructor(props) {
    super(props);
    this.state = {
      tooltip: {
        hidden: true
      }
    };
  }

  componentDidMount() {
    this._svg_node = ReactDOM.findDOMNode(this).getElementsByTagName('svg')[0];
  }

  componentWillMount() {
    helpers.calculateInner(this, this.props);
    helpers.arrayify(this, this.props);
    helpers.makeScales(this, this.props);
  }

  componentWillReceiveProps(nextProps) {
    helpers.calculateInner(this, nextProps);
    helpers.arrayify(this, nextProps);
    helpers.makeScales(this, nextProps);
  }

  handleMouseMove(e, data) {
    if (!this.props.tooltipHtml) {
      return;
    }

    e.preventDefault();

    const {
      margin,
      tooltipMode,
      tooltipOffset,
      tooltipContained
    } = this.props;

    const svg = this._svg_node;
    let position;
    if (svg.createSVGPoint) {
      let point = svg.createSVGPoint();
      point.x = e.clientX;
      point.y = e.clientY;
      point = point.matrixTransform(svg.getScreenCTM().inverse());
      position = [point.x - margin.left, point.y - margin.top];
    } else {
      const rect = svg.getBoundingClientRect();
      position = [e.clientX - rect.left - svg.clientLeft - margin.left,
      e.clientY - rect.top - svg.clientTop - margin.top];
    }

    const [html, xPos, yPos] = this._tooltipHtml(data, position);
    const svgTop = svg.getBoundingClientRect().top + margin.top;
    const svgLeft = svg.getBoundingClientRect().left + margin.left;

    let top = 0;
    let left = 0;

    if (tooltipMode === 'fixed') {
      top = svgTop + tooltipOffset.top;
      left = svgLeft + tooltipOffset.left;
    } else if (tooltipMode === 'element') {
      top = svgTop + yPos + tooltipOffset.top;
      left = svgLeft + xPos + tooltipOffset.left;
    } else { // mouse
      top = e.clientY + tooltipOffset.top;
      left = e.clientX + tooltipOffset.left;
    }

    function lerp(t, a, b) {
      return (1 - t) * a + t * b;
    }

    let translate = 50;

    if (tooltipContained) {
      const t = position[0] / svg.getBoundingClientRect().width;
      translate = lerp(t, 0, 100);
    }

    this.setState({
      tooltip: {
        top: top,
        left: left,
        hidden: false,
        html: html,
        translate: translate
      }
    });
  }

  handleMouseLeave(e) {
    if (!this.props.tooltipHtml) {
      return;
    }

    e.preventDefault();

    this.setState({
      tooltip: {
        hidden: true
      }
    });
  }

  /*
     The code below supports finding the data values for the line closest to the mouse cursor.
     Since it gets all events from the Rect overlaying the Chart the tooltip gets shown everywhere.
     For now I don't want to use this method.
     */
  _tooltipHtml(data, position) {

    const { x, y, values, label } = this.props;
    const [xScale, yScale] = [this._xScale, this._yScale];

    const xValueCursor = xScale.invert(position[0]);
    const yValueCursor = yScale.invert(position[1]);

    const xBisector = d3.bisector(e => { return x(e); }).left;

    const valuesAtX = data.map(function(stack) {
      const idx = xBisector(values(stack), xValueCursor);

      const indexRight = idx === values(stack).length ? idx - 1 : idx;
      const valueRight = x(values(stack)[indexRight]);

      const indexLeft = idx === 0 ? idx : idx - 1;
      const valueLeft = x(values(stack)[indexLeft]);

      let index;
      if (Math.abs(xValueCursor - valueRight) < Math.abs(xValueCursor - valueLeft)) {
        index = indexRight;
      } else {
        index = indexLeft;
      }

      return { label: label(stack), value: values(stack)[index] };
    });

    valuesAtX.sort((a, b) => { return y(a.value) - y(b.value); });

    const yBisector = d3.bisector(e => { return y(e.value); }).left;
    const yIndex = yBisector(valuesAtX, yValueCursor);

    const yIndexRight = yIndex === valuesAtX.length ? yIndex - 1 : yIndex;
    const yIndexLeft = yIndex === 0 ? yIndex : yIndex - 1;

    const yValueRight = y(valuesAtX[yIndexRight].value);
    const yValueLeft = y(valuesAtX[yIndexLeft].value);

    let index;
    if (Math.abs(yValueCursor - yValueRight) < Math.abs(yValueCursor - yValueLeft)) {
      index = yIndexRight;
    } else {
      index = yIndexLeft;
    }

    this._tooltipData = valuesAtX[index];

    const html = this.props.tooltipHtml(valuesAtX[index].label, valuesAtX[index].value);

    const xPos = xScale(valuesAtX[index].value.x);
    const yPos = yScale(valuesAtX[index].value.y);
    return [html, xPos, yPos];
  }

  render() {
    const {
      height,
      width,
      margin,
      colorScale,
      interpolate,
      defined,
      stroke,
      values,
      label,
      x,
      y,
      xAxis,
      yAxis,
      shape,
      shapeColor,
      legend
    } = this.props;

    const [
      data,
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      xIntercept,
      yIntercept
    ] = [
      this._data,
      this._innerWidth,
      this._innerHeight,
      this._xScale,
      this._yScale,
      this._xIntercept,
      this._yIntercept
    ];

    const handleMouseMove = this.handleMouseMove.bind(this);
    const handleMouseLeave = this.handleMouseLeave.bind(this);

    const line = d3.svg.line()
      .x(function(e) { return xScale(x(e)); })
      .y(function(e) { return yScale(y(e)); })
      .interpolate(interpolate)
      .defined(defined);

    let tooltipSymbol;
    if (!this.state.tooltip.hidden) {
      const symbol = d3.svg.symbol().type(shape);
      const symbolColor = shapeColor ? shapeColor : colorScale(this._tooltipData.label);

      const translate = this._tooltipData ? `translate(${xScale(x(this._tooltipData.value))}, ${yScale(y(this._tooltipData.value))})` : '';
      tooltipSymbol = this.state.tooltip.hidden ? null : <path className='dot' d={symbol()} transform={translate} fill={symbolColor} onMouseMove={ function(evt) { handleMouseMove(evt, data); } } onMouseLeave={handleMouseLeave} />;
    }

    const sizeId = innerWidth + 'x' + innerHeight;

    const lines = data.map(function(stack, index){
      return (
        <Path
        key={`${label(stack)}.${index}`}
        className={'line'}
        d={line(values(stack))}
        stroke={colorScale(label(stack))}
        strokeWidth={typeof stroke.strokeWidth === 'function' ? stroke.strokeWidth(label(stack)) : stroke.strokeWidth}
        strokeLinecap={typeof stroke.strokeLinecap === 'function' ? stroke.strokeLinecap(label(stack)) : stroke.strokeLinecap}
        strokeDasharray={typeof stroke.strokeDasharray === 'function' ? stroke.strokeDasharray(label(stack)) : stroke.strokeDasharray}
        data={values(stack)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{clipPath: `url(#lineClip_${sizeId})`}}
        />
      );
    });

    //The <rect> below is needed in case we want to show the tooltip no matter where on the chart the mouse is.  Not sure if this should be used.
    const rect = ReactDOMServer.renderToString(<rect width={innerWidth} height={innerHeight}/>);

    return (
      <div>
        <Chart className='chart' height={height} width={width} margin={margin} legend={legend}>
          <Axis className={'x axis'} orientation={'bottom'} scale={xScale} height={innerHeight} width={innerWidth} zero={yIntercept} {...xAxis} />
          <Axis className={'y axis'} orientation={'left'} scale={yScale} height={innerHeight} width={innerWidth} zero={xIntercept} {...yAxis} />
          <g>
            <g dangerouslySetInnerHTML={{__html: `<defs><clipPath id="lineClip_${sizeId}">${rect}`}}/>
            {lines}
            <rect width={innerWidth} height={innerHeight} fill={'none'} stroke={'none'} style={{pointerEvents: 'all'}} onMouseMove={ function(evt){ handleMouseMove(evt, data); } } onMouseLeave={ handleMouseLeave } />
          </g>
          { this.props.children }
          {tooltipSymbol}
        </Chart>
        <Tooltip {...this.state.tooltip} className={ this.props.tooltipClassName } />
    </div>);
  }

}

export default LineChart;
