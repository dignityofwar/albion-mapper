import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import ZoneHeader from '../src/components/flow/zone/ZoneHeader.vue'

describe('ZoneHeader', () => {
  it('passes proximityTo to TagZone and renders it', async () => {
    const wrapper = mount(ZoneHeader, {
      props: {
        id: 'test-id',
        type: 'outlands',
        proximityTo: "Arthur's Rest"
      }
    })
    
    // Check if TagZone component was mounted with correct proximityTo prop
    const tagZone = wrapper.findComponent({ name: 'TagZone' })
    expect(tagZone.props('proximityTo')).toBe("Arthur's Rest")

    // Add delay for rendering
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(wrapper.text()).toContain("Arthur's Rest")
  })
})
